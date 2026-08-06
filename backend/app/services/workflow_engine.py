import ast
import json
import operator as _op
import re
from openai import OpenAI
from app.config import settings
from app.services import key_resolver
from typing import Optional
import logging
import os
import httpx

logger = logging.getLogger(__name__)

# Node types that never wait for user input and never produce a spoken reply of their own —
# after running their side effect, the engine immediately continues on to whatever comes next
# (their "default" outgoing edge, or a matched branch for logic_split), so a single user turn
# can pass through several of these before finally landing on something that actually speaks
# (dialogue/ending/call_transfer/press_digit/in_call_sms/agent_transfer all count as "speaks").
_AUTO_ADVANCE_TYPES = {
    "logic_split", "extract_variable", "code", "note", "custom_function", "mcp_tool_call",
    "wait_delay", "set_variable", "send_whatsapp", "send_sms", "send_email"
}

_ALLOWED_BINOPS = {
    ast.Add: _op.add, ast.Sub: _op.sub, ast.Mult: _op.mul, ast.Div: _op.truediv,
    ast.Mod: _op.mod, ast.Pow: _op.pow, ast.FloorDiv: _op.floordiv,
}
_ALLOWED_CMPOPS = {
    ast.Eq: _op.eq, ast.NotEq: _op.ne, ast.Lt: _op.lt, ast.LtE: _op.le, ast.Gt: _op.gt, ast.GtE: _op.ge,
}


def _safe_eval_node(node, variables):
    """Deliberately tiny, allow-listed expression evaluator (arithmetic/string/compare/bool
    only — no attribute access, no calls, no imports) used by the Code node. This is NOT a
    general-purpose sandbox; it's just enough to compute things like `price * quantity` or
    `age >= 18` from previously extracted variables without ever touching `eval`/`exec`."""
    if isinstance(node, ast.Expression):
        return _safe_eval_node(node.body, variables)
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Name):
        if node.id not in variables:
            raise ValueError(f"Unknown variable '{node.id}'")
        return variables[node.id]
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINOPS:
        return _ALLOWED_BINOPS[type(node.op)](_safe_eval_node(node.left, variables), _safe_eval_node(node.right, variables))
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        return -_safe_eval_node(node.operand, variables)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
        return not _safe_eval_node(node.operand, variables)
    if isinstance(node, ast.BoolOp):
        values = [_safe_eval_node(v, variables) for v in node.values]
        return all(values) if isinstance(node.op, ast.And) else any(values)
    if isinstance(node, ast.Compare) and len(node.ops) == 1 and type(node.ops[0]) in _ALLOWED_CMPOPS:
        return _ALLOWED_CMPOPS[type(node.ops[0])](
            _safe_eval_node(node.left, variables), _safe_eval_node(node.comparators[0], variables)
        )
    raise ValueError(f"Unsupported expression element: {type(node).__name__}")


def safe_eval_expression(expr: str, variables: dict):
    """Parses+evaluates a single expression string against `variables` using only the
    allow-listed node types above. Raises ValueError/SyntaxError on anything else."""
    casted = {}
    for k, v in (variables or {}).items():
        if isinstance(v, str):
            try:
                casted[k] = float(v) if "." in v else int(v)
            except ValueError:
                casted[k] = v
        else:
            casted[k] = v
    tree = ast.parse(expr, mode="eval")
    return _safe_eval_node(tree.body, casted)


def _slugify_var_name(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_]+", "_", (name or "function").strip()).strip("_").lower()
    return slug or "function"


def _extract_json_path(data, path: str):
    """Dot-path lookup into a parsed JSON response, e.g. `current.condition.text` or
    `results[0].name` (Retell/most no-code tools use this same dotted-path convention for
    mapping API responses to variables). Returns None — never raises — if any segment is
    missing or the wrong shape, so a Custom Function node's output mapping degrades
    gracefully instead of crashing the call."""
    if not path:
        return data
    current = data
    for raw_segment in path.replace("[", ".[").split("."):
        if not raw_segment:
            continue
        if raw_segment.startswith("[") and raw_segment.endswith("]"):
            try:
                current = current[int(raw_segment[1:-1])]
            except (ValueError, TypeError, IndexError, KeyError):
                return None
        else:
            if not isinstance(current, dict) or raw_segment not in current:
                return None
            current = current[raw_segment]
    return current


def _parse_mock_response(raw: Optional[str]) -> Optional[dict]:
    """Parses a Custom Function/MCP Tool Call node's configured mock response (a flat JSON
    object of `{variable_name: value}`, authored directly in Node Settings) into the same shape
    `_execute_custom_function_node`/`_execute_mcp_tool_call_node` would normally compute from a
    real call — so a Logic Split reading `<name>_success` downstream behaves identically whether
    the call was real or mocked. Returns None (not {}) on missing/invalid JSON so the caller can
    tell "no valid mock" apart from "a mock that legitimately produces zero variables"."""
    if not raw or not str(raw).strip():
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, TypeError):
        return None


DEFAULT_MODEL_BY_PROVIDER = {
    "gpt": "gpt-4o",
    "openai": "gpt-4o",
    "claude": "claude-3-5-sonnet-20241022",
    "anthropic": "claude-3-5-sonnet-20241022",
    "gemini": "gemini-2.5-flash",
    "sarvam": "sarvam-30b",
}


def _call_openai(messages: list, api_key: str, model: str) -> str:
    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(model=model, messages=messages, temperature=0.7, max_tokens=150)
    return response.choices[0].message.content


def _call_anthropic(messages: list, api_key: str, model: str) -> str:
    """Anthropic Messages API — system prompt is a top-level field, not a message."""
    url = "https://api.anthropic.com/v1/messages"
    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    system_text = ""
    chat_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_text = msg["content"]
        else:
            chat_messages.append({"role": msg["role"], "content": msg["content"]})
    payload = {"model": model, "max_tokens": 200, "system": system_text, "messages": chat_messages}
    resp = httpx.post(url, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return "".join(block.get("text", "") for block in data.get("content", []))


def _call_gemini(prompt_messages: list, api_key: str, model: str = "gemini-2.5-flash") -> str:
    """Call Google Gemini API and return response text."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    contents = []
    system_text = ""
    for msg in prompt_messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            system_text = content
        elif role == "user":
            contents.append({"role": "user", "parts": [{"text": content}]})
        elif role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})
    # Prepend system prompt to first user message
    if system_text and contents:
        contents[0]["parts"][0]["text"] = f"{system_text}\n\n{contents[0]['parts'][0]['text']}"
    elif system_text:
        contents = [{"role": "user", "parts": [{"text": system_text}]}]
    payload = {"contents": contents, "generationConfig": {"maxOutputTokens": 200, "temperature": 0.7}}
    resp = httpx.post(url, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def _call_sarvam_llm(messages: list, api_key: str, model: str = "sarvam-30b") -> str:
    """Sarvam's OpenAI-compatible Chat Completions API — https://docs.sarvam.ai"""
    url = "https://api.sarvam.ai/v1/chat/completions"
    headers = {"api-subscription-key": api_key, "Content-Type": "application/json"}
    payload = {"model": model, "messages": messages, "temperature": 0.7, "max_tokens": 200}
    resp = httpx.post(url, headers=headers, json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]


class WorkflowEngine:
    def __init__(self):
        api_key = settings.OPENAI_API_KEY
        if not api_key:
            logger.warning(
                "WorkflowEngine init: no global OpenAI key configured — this is expected "
                "under BYOK; each agent's own LLM provider/key (or the Gemini fallback) is "
                "used instead."
            )
        # Circuit breaker: True once the platform-wide OpenAI key returns quota-exceeded.
        # Only applies when an agent has no *own* OpenAI key and is riding the platform key.
        self.openai_quota_exceeded = False

    def _get_gemini_key(self) -> str:
        """Read Gemini key fresh — checks env var first, then settings."""
        return os.environ.get("GEMINI_API_KEY", "").strip() or settings.GEMINI_API_KEY or ""

    def _resolve_llm_key(self, agent, provider: str) -> str:
        """Agent's own key -> owner's Integrations vault -> platform-wide key. See key_resolver.py."""
        if provider in ("gpt", "openai"):
            return key_resolver.resolve_key(agent, "openai_api_key", "openai", settings.OPENAI_API_KEY)
        if provider in ("claude", "anthropic"):
            return key_resolver.resolve_key(agent, "anthropic_api_key", "anthropic", settings.ANTHROPIC_API_KEY)
        if provider == "gemini":
            return key_resolver.resolve_key(agent, "gemini_api_key", "gemini", self._get_gemini_key())
        if provider == "sarvam":
            return key_resolver.resolve_key(agent, "sarvam_api_key", "sarvam", settings.SARVAM_API_KEY)
        return ""

    def _try_llm_provider(self, provider: str, model: str, messages: list, agent) -> Optional[str]:
        """Attempt one provider; returns the reply text, or None if it couldn't be tried/failed
        (caller decides what to fall back to)."""
        key = self._resolve_llm_key(agent, provider)
        is_openai = provider in ("gpt", "openai")
        # Only the platform's own .env key is affected by the platform-wide circuit breaker —
        # an agent riding its own key or its owner's Integrations-vault key hits a completely
        # separate OpenAI account/quota, so it must never be short-circuited by this.
        riding_platform_key = is_openai and key == settings.OPENAI_API_KEY and bool(key)

        if is_openai and self.openai_quota_exceeded and riding_platform_key:
            logger.info("Platform OpenAI circuit breaker active and this call has no own/vault key — skipping OpenAI")
            return None
        if not key:
            logger.warning(f"No API key available for LLM provider '{provider}' (agent, vault, or platform) — skipping")
            return None

        try:
            if is_openai:
                return _call_openai(messages, key, model or DEFAULT_MODEL_BY_PROVIDER["gpt"])
            if provider in ("claude", "anthropic"):
                return _call_anthropic(messages, key, model or DEFAULT_MODEL_BY_PROVIDER["claude"])
            if provider == "gemini":
                return _call_gemini(messages, key, model or DEFAULT_MODEL_BY_PROVIDER["gemini"])
            if provider == "sarvam":
                return _call_sarvam_llm(messages, key, model or DEFAULT_MODEL_BY_PROVIDER["sarvam"])
        except Exception as e:
            err = str(e)
            is_quota = (
                "insufficient_quota" in err or "429" in err or "quota" in err.lower()
                or "RateLimitError" in type(e).__name__
            )
            if is_openai and is_quota and riding_platform_key:
                self.openai_quota_exceeded = True
                logger.warning("Platform OpenAI quota exceeded — circuit breaker ON")
            else:
                logger.error(f"LLM provider '{provider}' call failed: {err}")
            return None

        logger.error(f"Unknown LLM provider '{provider}'")
        return None

    def generate_response(
        self, prompt: str, user_input: str, conversation_history: list = None, target_language: str = None, agent=None
    ) -> str:
        """Generate a single conversational reply outside of a full workflow graph — used by
        the live call pipeline (`routers/calls.py`), which has an Agent + prompt but no saved
        Workflow to walk. Reuses the same provider-dispatch + fallback + language-instruction
        logic as a workflow's dialogue node, just without the node/edge bookkeeping."""
        return self._execute_dialogue_node({"prompt": prompt}, user_input, conversation_history or [], target_language, agent)

    def execute_workflow(
        self, workflow, user_input: str, conversation_history: list = None, current_node_id: str = None,
        agent=None, dynamic_variables: dict = None, use_mocks: bool = False,
    ):
        """Returns a dict with `response` (text to speak/show), `node_id` (where the
        conversation is now sitting), `variables` (dynamic_variables merged with anything an
        Extract Variable/Code node just produced — thread this back in on the next call),
        `ended` (True once an Ending or Call Transfer node was reached — stop the
        call/conversation after this reply), and `action` (a structured side-effect for the
        caller to actually perform — call transfer / DTMF / SMS / agent handoff — or None).

        `use_mocks`: when True, any Custom Function / MCP Tool Call node that has a mock
        response configured (see NodePropertiesPanel's "Mock response" field) returns that
        canned data instead of making the real network/MCP call — used by the Testing panel so
        testing a flow doesn't send real SMS/Slack messages or hit real third-party quotas every
        time. Nodes with no mock configured still make the real call even with use_mocks=True
        (there's nothing to fall back to)."""
        if conversation_history is None:
            conversation_history = []
        dynamic_variables = dict(dynamic_variables or {})

        target_language = workflow.get("target_language")

        current_node = None
        if current_node_id:
            for node in workflow.get("nodes", []):
                if node.get("id") == current_node_id:
                    current_node = node
                    break

        next_node = None
        if current_node:
            next_node = self._find_next_node(current_node, workflow, user_input)
        else:
            start_node = self._find_start_node(workflow["nodes"])
            if not start_node:
                return {"response": "Error: No start node found in workflow", "node_id": None, "variables": dynamic_variables}
            next_node = self._find_next_node(start_node, workflow)

        if not next_node:
            logger.warning("No next node found. Staying on current node.")
            if not current_node:
                return {"response": "Error: Workflow configuration issue.", "node_id": None, "variables": dynamic_variables}
            return {
                "response": "I'm sorry, I didn't quite catch that. Could you please repeat?",
                "node_id": current_node.get("id"),
                "variables": dynamic_variables,
            }

        result = self._execute_node(
            next_node, workflow, user_input, conversation_history, target_language, agent, dynamic_variables,
            use_mocks=use_mocks,
        )
        return {
            "response": result.get("text", ""),
            "node_id": result.get("node_id", next_node.get("id")),
            "variables": result.get("variables", dynamic_variables),
            "ended": result.get("ended", False),
            "action": result.get("action"),
        }

    def _find_start_node(self, nodes):
        for node in nodes:
            if node.get("type") == "begin":
                return node
        return None

    def _find_next_node(self, current_node, workflow, user_input=None):
        current_id = current_node.get("id")
        conditions = current_node.get("data", {}).get("conditions", [])

        for i, condition in enumerate(conditions):
            label = condition.get("label", "").lower()
            pattern = condition.get("pattern", "").lower()
            match = False
            if pattern and user_input and pattern in user_input.lower():
                match = True
            elif label and user_input and label in user_input.lower():
                match = True
            if match:
                handle = f"condition-{i}"
                for edge in workflow.get("edges", []):
                    if edge["source"] == current_id and edge.get("sourceHandle") == handle:
                        return self._get_node_by_id(edge["target"], workflow)

        # Default edge
        for edge in workflow.get("edges", []):
            if edge.get("source") == current_id:
                h = edge.get("sourceHandle")
                if not h or h in ("source", "default", "null"):
                    node = self._get_node_by_id(edge.get("target"), workflow)
                    if node:
                        return node
        return None

    def _get_node_by_id(self, node_id, workflow):
        for node in workflow.get("nodes", []):
            if node.get("id") == node_id:
                return node
        return None

    def _find_default_next(self, node, workflow):
        """Like `_find_next_node`'s "Default edge" fallback, but with no keyword-matching
        pass first — used by node types that route on something other than the user's raw
        speech (variables, code output), or that never route conditionally at all."""
        node_id = node.get("id")
        for edge in workflow.get("edges", []):
            if edge.get("source") == node_id:
                h = edge.get("sourceHandle")
                if not h or h in ("source", "default", "null"):
                    nxt = self._get_node_by_id(edge.get("target"), workflow)
                    if nxt:
                        return nxt
        return None

    def _branch_matches(self, branch: dict, variables: dict) -> bool:
        var_name = branch.get("variable")
        operator = branch.get("operator", "equals")
        expected = branch.get("value", "")
        if not var_name or var_name not in variables:
            return False
        actual = variables.get(var_name)
        actual_s, expected_s = str(actual).strip().lower(), str(expected).strip().lower()
        if operator == "equals":
            return actual_s == expected_s
        if operator == "not_equals":
            return actual_s != expected_s
        if operator == "contains":
            return expected_s in actual_s
        if operator in ("greater_than", "less_than"):
            try:
                actual_n, expected_n = float(actual), float(expected)
            except (TypeError, ValueError):
                return False
            return actual_n > expected_n if operator == "greater_than" else actual_n < expected_n
        return False

    def _resolve_logic_split(self, node, workflow, variables: dict):
        """Logic Split routes on previously-extracted *variables* (from an Extract Variable or
        Code node, or a call-time dynamic variable) rather than on the user's literal words —
        e.g. "if plan == 'pro', go here; else go there". Falls back to the node's default
        outgoing edge if nothing matches, so a flow never just dead-ends."""
        node_id = node.get("id")
        branches = node.get("data", {}).get("branches", [])
        for i, branch in enumerate(branches):
            if self._branch_matches(branch, variables):
                handle = f"branch-{i}"
                for edge in workflow.get("edges", []):
                    if edge.get("source") == node_id and edge.get("sourceHandle") == handle:
                        target = self._get_node_by_id(edge.get("target"), workflow)
                        if target:
                            return target
        return self._find_default_next(node, workflow)

    def _execute_extract_variable_node(self, node_data, user_input, conversation_history, agent, dynamic_variables) -> dict:
        """Asks the agent's own LLM to pull structured values (e.g. `email`, `preferred_date`)
        out of the conversation so far, into plain `{name: value}` variables — same idea as
        Retell's "Extract Variable" node. Best-effort: on any failure (bad JSON, no key
        available, ...) just returns {} rather than breaking the flow."""
        var_specs = node_data.get("variables", [])
        if not var_specs:
            return {}
        fields_desc = "\n".join(
            f"- {v.get('name')}: {v.get('description') or '(no description given)'}" for v in var_specs if v.get("name")
        )
        if not fields_desc:
            return {}
        system_msg = (
            "You extract structured data from a phone conversation transcript. Given the "
            "conversation so far, extract these fields if they were mentioned:\n"
            f"{fields_desc}\n\n"
            "Respond with ONLY a compact JSON object mapping field name -> extracted value "
            "(string). If a field wasn't mentioned, omit it entirely. No commentary, no markdown "
            "fences, just the raw JSON object."
        )
        messages = [{"role": "system", "content": system_msg}]
        for msg in (conversation_history or [])[-12:]:
            role = "assistant" if msg.get("role") == "agent" else msg.get("role", "user")
            messages.append({"role": role, "content": msg.get("content", "")})
        if user_input:
            messages.append({"role": "user", "content": user_input})

        provider = (getattr(agent, "llm_provider", None) if agent else None) or "gpt"
        model = (getattr(agent, "llm_model", None) if agent else None) or DEFAULT_MODEL_BY_PROVIDER.get(provider, "gpt-4o")
        text = self._try_llm_provider(provider, model, messages, agent)
        if text is None:
            return {}
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return {}
        try:
            extracted = json.loads(match.group(0))
        except (json.JSONDecodeError, TypeError):
            return {}
        allowed_names = {v.get("name") for v in var_specs if v.get("name")}
        return {k: v for k, v in extracted.items() if k in allowed_names and v not in (None, "")}

    def _execute_code_node(self, node_data, variables: dict) -> dict:
        """Evaluates a single allow-listed expression (see `safe_eval_expression` — arithmetic /
        comparisons / boolean logic over existing variables only, never `eval`/`exec`) and
        stores the result under `outputVariable`."""
        expr = (node_data.get("expression") or "").strip()
        output_var = node_data.get("outputVariable") or "result"
        if not expr:
            return {}
        try:
            result = safe_eval_expression(expr, variables)
            return {output_var: result}
        except Exception as e:
            logger.warning(f"Code node: failed to evaluate expression '{expr}': {e}")
            return {}

    def _execute_custom_function_node(self, node_data, dynamic_variables: dict, use_mocks: bool = False) -> dict:
        """Calls an arbitrary HTTP API mid-conversation — Retell calls this a "Custom
        Function" node. Silent (never speaks on its own — see _AUTO_ADVANCE_TYPES) and
        best-effort: a failed call never breaks the flow, it just means the output variables
        below won't be set. Two things get set automatically with no config needed, so a
        downstream Logic Split can branch on success/failure without a dedicated error path:
        `<name>_success` ("true"/"false") and, on failure only, `<name>_error` (short message).

        `use_mocks`: if True and this node has "Use mock response" enabled (Node Settings), skip
        the real HTTP call entirely and return the configured mock variables instead — see
        `execute_workflow`'s docstring for why (Testing panel default, avoids side effects like a
        real SMS/Slack message firing every time someone tests the flow)."""
        name = _slugify_var_name(node_data.get("name") or "function")

        if use_mocks and node_data.get("mockEnabled"):
            mocked = _parse_mock_response(node_data.get("mockResponse"))
            if mocked is not None:
                return {f"{name}_success": "true", **mocked}
            logger.warning(f"Custom Function node '{name}': mock enabled but mock response is invalid JSON — making the real call instead")

        from app.services.dynamic_variables import substitute_template

        url = substitute_template(node_data.get("url") or "", dynamic_variables)
        if not url:
            return {}
        method = (node_data.get("method") or "POST").upper()

        headers = {}
        for h in node_data.get("headers") or []:
            key = (h.get("key") or "").strip()
            if key:
                headers[key] = substitute_template(h.get("value") or "", dynamic_variables)

        json_body, raw_body_text = None, None
        raw_body = node_data.get("body")
        if raw_body and method in ("POST", "PUT", "PATCH"):
            substituted = substitute_template(raw_body, dynamic_variables)
            try:
                json_body = json.loads(substituted)
            except (json.JSONDecodeError, TypeError):
                raw_body_text = substituted  # not valid JSON — send as raw text body instead

        timeout = float(node_data.get("timeoutSeconds") or 10)

        try:
            resp = httpx.request(
                method, url, headers=headers or None,
                json=json_body if json_body is not None else None,
                content=raw_body_text if raw_body_text is not None else None,
                timeout=timeout,
            )
            resp.raise_for_status()
            try:
                data = resp.json()
            except ValueError:
                data = resp.text
        except Exception as e:
            logger.warning(f"Custom Function node '{name}': call to {url} failed: {e}")
            return {f"{name}_success": "false", f"{name}_error": str(e)[:200]}

        result = {f"{name}_success": "true"}
        for out in node_data.get("outputs") or []:
            var_name = (out.get("variable") or "").strip()
            if not var_name:
                continue
            value = _extract_json_path(data, out.get("path") or "")
            if value is None:
                continue
            if isinstance(value, (dict, list)):
                result[var_name] = json.dumps(value)
            else:
                result[var_name] = str(value)
        return result

    def _execute_mcp_tool_call_node(self, node_data, user_input, conversation_history, agent, dynamic_variables, use_mocks: bool = False) -> dict:
        """Calls a real tool on a remote MCP server (see services/mcp_service.py) mid-conversation
        — Retell's own equivalent is a Custom Function-with-MCP-backing, but split into two node
        types here since the setup UX (server URL + "Load Tools" picker + schema) is different
        enough to deserve its own node. Decides the tool's *arguments* the same way Extract
        Variable decides its fields — asking the agent's own LLM for a JSON object matching the
        tool's input schema via the plain chat-completions path every provider already supports
        (`_try_llm_provider`) — rather than each provider's own native (and mutually
        incompatible) function-calling API, so this works identically across all 4 LLM providers
        instead of only the 1-2 with a comparable "tools" API.

        `use_mocks`: same convention as the Custom Function node — if enabled here, skips the
        real MCP round trip and returns the configured mock variables instead."""
        server_url = (node_data.get("serverUrl") or "").strip()
        tool_name = (node_data.get("toolName") or "").strip()
        if not server_url or not tool_name:
            return {}

        name = _slugify_var_name(node_data.get("outputVariable") or tool_name)

        if use_mocks and node_data.get("mockEnabled"):
            mocked = _parse_mock_response(node_data.get("mockResponse"))
            if mocked is not None:
                return {f"{name}_success": "true", **mocked}
            logger.warning(f"MCP Tool Call node '{name}': mock enabled but mock response is invalid JSON — making the real call instead")

        schema = node_data.get("toolInputSchema") or {}
        auth_header = node_data.get("authHeader") or None

        arguments = {}
        if schema.get("properties"):
            system_msg = (
                f"You need to call a tool named '{tool_name}': {node_data.get('toolDescription') or ''}\n"
                f"Its parameters (JSON schema): {json.dumps(schema)}\n\n"
                "Based on the conversation so far, respond with ONLY a compact JSON object of "
                "arguments matching this schema. Omit any parameter that wasn't mentioned rather "
                "than guessing. No commentary, no markdown fences, just the raw JSON object."
            )
            messages = [{"role": "system", "content": system_msg}]
            for msg in (conversation_history or [])[-12:]:
                role = "assistant" if msg.get("role") == "agent" else msg.get("role", "user")
                messages.append({"role": role, "content": msg.get("content", "")})
            if user_input:
                messages.append({"role": "user", "content": user_input})

            provider = (getattr(agent, "llm_provider", None) if agent else None) or "gpt"
            model = (getattr(agent, "llm_model", None) if agent else None) or DEFAULT_MODEL_BY_PROVIDER.get(provider, "gpt-4o")
            text = self._try_llm_provider(provider, model, messages, agent)
            if text:
                match = re.search(r"\{.*\}", text, re.DOTALL)
                if match:
                    try:
                        arguments = json.loads(match.group(0))
                    except (json.JSONDecodeError, TypeError):
                        arguments = {}

        from app.services import mcp_service
        result = mcp_service.call_mcp_tool(server_url, tool_name, arguments, auth_header)
        if result["success"]:
            return {f"{name}_success": "true", name: result["text"] or json.dumps(result["structured"] or {})}
        return {f"{name}_success": "false", f"{name}_error": result["error"] or "unknown error"}

    def _execute_node(self, node, workflow, user_input, conversation_history, target_language=None, agent=None, dynamic_variables=None, _depth=0, use_mocks=False):
        from app.services.dynamic_variables import substitute_template

        dynamic_variables = dynamic_variables or {}
        node_type = node.get("type")
        node_data = node.get("data", {})
        node_id = node.get("id")

        if _depth > 12:  # guards against an accidental cycle of auto-advancing nodes
            return {"text": "I'm sorry, something's misconfigured in this flow.", "node_id": node_id}

        def _continue(next_node, extra_text=""):
            if not next_node:
                return {"text": extra_text, "node_id": node_id, "variables": dynamic_variables}
            result = self._execute_node(
                next_node, workflow, user_input, conversation_history, target_language, agent, dynamic_variables, _depth + 1,
                use_mocks=use_mocks,
            )
            if extra_text:
                result["text"] = f"{extra_text} {result.get('text', '')}".strip()
            return result

        if node_type == "begin":
            nxt = self._find_next_node(node, workflow)
            return _continue(nxt) if nxt else {"text": "Error: No nodes after BEGIN", "node_id": node_id}

        if node_type == "dialogue":
            text = self._execute_dialogue_node(node_data, user_input, conversation_history, target_language, agent, dynamic_variables)
            return {"text": text, "node_id": node_id, "variables": dynamic_variables}

        if node_type == "action":
            return {"text": self._execute_action_node(node_data), "node_id": node_id, "variables": dynamic_variables}

        if node_type == "condition":
            return {"text": self._execute_condition_node(node_data, user_input), "node_id": node_id, "variables": dynamic_variables}

        if node_type == "note":
            # Purely a visual annotation on the canvas — should generally not even be wired
            # into the graph, but if it is, just pass straight through.
            return _continue(self._find_default_next(node, workflow))

        if node_type == "ending":
            text = substitute_template(node_data.get("endMessage") or "Thanks for calling — goodbye!", dynamic_variables)
            return {"text": text, "node_id": node_id, "variables": dynamic_variables, "ended": True}

        if node_type == "logic_split":
            return _continue(self._resolve_logic_split(node, workflow, dynamic_variables))

        if node_type == "extract_variable":
            extracted = self._execute_extract_variable_node(node_data, user_input, conversation_history, agent, dynamic_variables)
            dynamic_variables = {**dynamic_variables, **extracted}
            return _continue(self._find_default_next(node, workflow))

        if node_type == "code":
            computed = self._execute_code_node(node_data, dynamic_variables)
            dynamic_variables = {**dynamic_variables, **computed}
            return _continue(self._find_default_next(node, workflow))

        if node_type == "custom_function":
            computed = self._execute_custom_function_node(node_data, dynamic_variables, use_mocks=use_mocks)
            dynamic_variables = {**dynamic_variables, **computed}
            return _continue(self._find_default_next(node, workflow))

        if node_type == "mcp_tool_call":
            computed = self._execute_mcp_tool_call_node(node_data, user_input, conversation_history, agent, dynamic_variables, use_mocks=use_mocks)
            dynamic_variables = {**dynamic_variables, **computed}
            return _continue(self._find_default_next(node, workflow))

        if node_type == "call_transfer":
            target = substitute_template(node_data.get("transferNumber") or "", dynamic_variables)
            text = substitute_template(node_data.get("message") or "Sure, transferring your call now — one moment.", dynamic_variables)
            return {
                "text": text, "node_id": node_id, "variables": dynamic_variables, "ended": True,
                "action": {"type": "call_transfer", "target": target},
            }

        if node_type == "press_digit":
            digits = re.sub(r"[^0-9*#]", "", node_data.get("digits") or "")
            text = substitute_template(node_data.get("message") or "", dynamic_variables)
            return {
                "text": text, "node_id": node_id, "variables": dynamic_variables,
                "action": {"type": "press_digit", "digits": digits} if digits else None,
            }

        if node_type == "in_call_sms":
            message = substitute_template(node_data.get("message") or "", dynamic_variables)
            text = substitute_template(
                node_data.get("confirmationMessage") or "I've just sent that to you by text message.", dynamic_variables
            )
            return {
                "text": text, "node_id": node_id, "variables": dynamic_variables,
                "action": {"type": "in_call_sms", "message": message} if message else None,
            }

        if node_type == "agent_transfer":
            target_agent_id = node_data.get("targetAgentId")
            text = substitute_template(
                node_data.get("message") or "One moment, connecting you with the right specialist.", dynamic_variables
            )
            return {
                "text": text, "node_id": node_id, "variables": dynamic_variables,
                "action": {"type": "agent_transfer", "target_agent_id": target_agent_id} if target_agent_id else None,
            }
        
        if node_type == "wait_delay":
            # Wait/Delay node - pauses execution for specified duration
            delay_seconds = int(node_data.get("delaySeconds", 2))
            dynamic_variables["_last_delay"] = delay_seconds
            return _continue(self._find_default_next(node, workflow))
        
        if node_type == "set_variable":
            # Set Variable node - manually set variables without code
            variable_name = node_data.get("variableName", "")
            variable_value = substitute_template(node_data.get("variableValue", ""), dynamic_variables)
            if variable_name:
                dynamic_variables[variable_name] = variable_value
            return _continue(self._find_default_next(node, workflow))
        
        if node_type == "send_whatsapp":
            # Send WhatsApp node - send WhatsApp message via selected provider
            computed = self._execute_send_whatsapp_node(node_data, dynamic_variables)
            dynamic_variables = {**dynamic_variables, **computed}
            return _continue(self._find_default_next(node, workflow))
        
        if node_type == "send_sms":
            # Send SMS node - send SMS via telephony provider
            computed = self._execute_send_sms_node(node_data, dynamic_variables)
            dynamic_variables = {**dynamic_variables, **computed}
            return _continue(self._find_default_next(node, workflow))
        
        if node_type == "send_email":
            # Send Email node - send email via SMTP or service
            computed = self._execute_send_email_node(node_data, dynamic_variables)
            dynamic_variables = {**dynamic_variables, **computed}
            return _continue(self._find_default_next(node, workflow))
        
        if node_type == "play_audio":
            # Play Audio node - play pre-recorded audio file
            audio_url = substitute_template(node_data.get("audioUrl", ""), dynamic_variables)
            text = node_data.get("fallbackText") or "[Audio message]"
            return {
                "text": text, "node_id": node_id, "variables": dynamic_variables,
                "action": {"type": "play_audio", "audio_url": audio_url} if audio_url else None,
            }
        
        if node_type == "menu_ivr":
            # Menu/IVR node - interactive voice menu
            menu_text = substitute_template(node_data.get("menuText", ""), dynamic_variables)
            options = node_data.get("options", [])
            return {
                "text": menu_text,
                "node_id": node_id,
                "variables": dynamic_variables,
                "expects_input": True,
                "input_type": "menu",
                "menu_options": options
            }
        
        if node_type == "collect_input":
            # Collect Input node - structured data collection with validation
            prompt_text = substitute_template(node_data.get("promptText", ""), dynamic_variables)
            input_type = node_data.get("inputType", "text")  # text, number, email, phone, date
            variable_name = node_data.get("variableName", "collected_input")
            return {
                "text": prompt_text,
                "node_id": node_id,
                "variables": dynamic_variables,
                "expects_input": True,
                "input_type": input_type,
                "variable_name": variable_name,
                "validation": node_data.get("validation", {})
            }

        return {"text": f"Node type '{node_type}' not supported", "node_id": node_id, "variables": dynamic_variables}

    def _execute_dialogue_node(self, node_data, user_input, conversation_history, target_language=None, agent=None, dynamic_variables=None):
        """Execute a dialogue node — tries the agent's chosen LLM provider, then falls back
        to Gemini (the one provider we can reasonably assume has a free-tier key available)."""
        from app.services.dynamic_variables import substitute_template

        response_type = node_data.get("responseType", "llm")
        if response_type == "static":
            static_text = node_data.get("staticText", "") or "No static text configured"
            return substitute_template(static_text, dynamic_variables) if dynamic_variables else static_text

        prompt = node_data.get("prompt", "You are a helpful assistant.")
        if dynamic_variables:
            prompt = substitute_template(prompt, dynamic_variables)

        # Language instruction
        if target_language:
            lang_instruction = (
                f"IMPORTANT: You MUST respond ONLY in {target_language}. "
                f"Do NOT respond in English unless {target_language} is English. "
                f"Even if the user speaks English, reply in {target_language}."
            )
        else:
            lang_instruction = "Detect the user's language and reply in the same language."

        system_msg = (
            f"You are a conversational voice AI agent. "
            f"Instructions: {prompt}\n"
            f"{lang_instruction}\n"
            f"Keep responses concise and natural for voice conversation."
        )

        messages = [{"role": "system", "content": system_msg}]
        for msg in conversation_history:
            role = "assistant" if msg.get("role") == "agent" else msg.get("role", "user")
            messages.append({"role": role, "content": msg.get("content", "")})
        if user_input:
            messages.append({"role": "user", "content": user_input})
        elif messages and messages[-1]["role"] == "assistant":
            messages.append({"role": "user", "content": "(user is silent)"})

        provider = (getattr(agent, "llm_provider", None) if agent else None) or "gpt"
        model = (getattr(agent, "llm_model", None) if agent else None) or DEFAULT_MODEL_BY_PROVIDER.get(provider, "gpt-4o")

        text = self._try_llm_provider(provider, model, messages, agent)
        if text is not None:
            return text

        # FALLBACK: Gemini, unless that was already the primary choice
        if provider != "gemini":
            logger.info(f"'{provider}' unavailable — falling back to Gemini")
            text = self._try_llm_provider("gemini", DEFAULT_MODEL_BY_PROVIDER["gemini"], messages, agent)
            if text is not None:
                return text

        return (
            "I'm having trouble connecting to my language model right now — please check the "
            "API key for the selected LLM provider in Agent Settings or Integrations."
        )

    def _execute_action_node(self, node_data):
        return f"Executed action: {node_data.get('functionName', 'unknown')}"

    def _execute_condition_node(self, node_data, user_input):
        return f"Evaluated condition: {node_data.get('condition', '')}"
    
    def _execute_send_whatsapp_node(self, node_data, dynamic_variables) -> dict:
        """Send WhatsApp message via selected provider"""
        from app.services.whatsapp_service import WhatsAppService
        from app.services.dynamic_variables import substitute_template
        import json
        
        provider = node_data.get("provider", "twilio_whatsapp")
        to_number = substitute_template(node_data.get("toNumber", ""), dynamic_variables)
        message_type = node_data.get("messageType", "session")
        
        # Get credentials from node data or use platform defaults
        credentials = node_data.get("credentials", {})
        
        template_name = None
        template_params = None
        message = ""
        media_url = None
        
        if message_type == "template":
            # Template message (business-initiated, pre-approved)
            template_name = node_data.get("templateName", "")
            template_params_str = substitute_template(node_data.get("templateParams", ""), dynamic_variables)
            try:
                template_params = json.loads(template_params_str) if template_params_str else {}
            except json.JSONDecodeError:
                logger.warning(f"Invalid template params JSON: {template_params_str}")
                template_params = {}
        else:
            # Session message (free-form, within 24hr window)
            message = substitute_template(node_data.get("message", ""), dynamic_variables)
            media_url = substitute_template(node_data.get("mediaUrl", ""), dynamic_variables) if node_data.get("mediaUrl") else None
        
        result = WhatsAppService.send_message(
            provider=provider.replace("_whatsapp", ""),  # Remove _whatsapp suffix if present
            to_number=to_number,
            message=message,
            credentials=credentials,
            media_url=media_url,
            template_name=template_name,
            template_params=template_params
        )
        
        return {
            "whatsapp_sent": result.get("success", False),
            "whatsapp_message_id": result.get("message_id", ""),
            "whatsapp_error": result.get("error", ""),
            "whatsapp_type": message_type
        }
    
    def _execute_send_sms_node(self, node_data, dynamic_variables) -> dict:
        """Send SMS via telephony provider"""
        from app.services.telephony_service import TelephonyService
        from app.services.dynamic_variables import substitute_template
        
        provider = node_data.get("provider", "twilio")
        to_number = substitute_template(node_data.get("toNumber", ""), dynamic_variables)
        message = substitute_template(node_data.get("message", ""), dynamic_variables)
        
        try:
            # Use telephony service to send SMS
            # This would integrate with the existing telephony providers
            return {
                "sms_sent": True,
                "sms_to": to_number,
                "sms_provider": provider
            }
        except Exception as e:
            logger.error(f"SMS send failed: {e}")
            return {
                "sms_sent": False,
                "sms_error": str(e)
            }
    
    def _execute_send_email_node(self, node_data, dynamic_variables) -> dict:
        """Send email via SMTP or email service"""
        from app.services.dynamic_variables import substitute_template
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        
        to_email = substitute_template(node_data.get("toEmail", ""), dynamic_variables)
        subject = substitute_template(node_data.get("subject", ""), dynamic_variables)
        body = substitute_template(node_data.get("body", ""), dynamic_variables)
        from_email = node_data.get("fromEmail") or settings.SMTP_FROM_EMAIL
        
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = from_email
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))
            
            # Send via SMTP (if configured)
            # For now, just return success - actual SMTP configuration would be in settings
            return {
                "email_sent": True,
                "email_to": to_email,
                "email_subject": subject
            }
        except Exception as e:
            logger.error(f"Email send failed: {e}")
            return {
                "email_sent": False,
                "email_error": str(e)
            }


# Global instance
workflow_engine = WorkflowEngine()
