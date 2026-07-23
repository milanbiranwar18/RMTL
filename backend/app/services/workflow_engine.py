from openai import OpenAI
from app.config import settings
from typing import Optional
import logging
import os
import httpx

logger = logging.getLogger(__name__)

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
        """Agent's own key first, then the platform-wide key for that provider."""
        if provider in ("gpt", "openai"):
            return (getattr(agent, "openai_api_key", None) if agent else None) or settings.OPENAI_API_KEY
        if provider in ("claude", "anthropic"):
            return (getattr(agent, "anthropic_api_key", None) if agent else None) or settings.ANTHROPIC_API_KEY
        if provider == "gemini":
            return (getattr(agent, "gemini_api_key", None) if agent else None) or self._get_gemini_key()
        if provider == "sarvam":
            return (getattr(agent, "sarvam_api_key", None) if agent else None) or settings.SARVAM_API_KEY
        return ""

    def _try_llm_provider(self, provider: str, model: str, messages: list, agent) -> Optional[str]:
        """Attempt one provider; returns the reply text, or None if it couldn't be tried/failed
        (caller decides what to fall back to)."""
        key = self._resolve_llm_key(agent, provider)
        is_openai = provider in ("gpt", "openai")

        if is_openai and self.openai_quota_exceeded and not (agent and agent.openai_api_key):
            logger.info("Platform OpenAI circuit breaker active and agent has no own key — skipping OpenAI")
            return None
        if not key:
            logger.warning(f"No API key available for LLM provider '{provider}' (agent or platform) — skipping")
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
            if is_openai and is_quota and not (agent and agent.openai_api_key):
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
        self, workflow, user_input: str, conversation_history: list = None, current_node_id: str = None, agent=None
    ):
        if conversation_history is None:
            conversation_history = []

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
                return {"response": "Error: No start node found in workflow", "node_id": None}
            next_node = self._find_next_node(start_node, workflow)

        if not next_node:
            logger.warning("No next node found. Staying on current node.")
            if not current_node:
                return {"response": "Error: Workflow configuration issue.", "node_id": None}
            return {"response": "I'm sorry, I didn't quite catch that. Could you please repeat?", "node_id": current_node.get("id")}

        response = self._execute_node(next_node, workflow, user_input, conversation_history, target_language, agent)
        return {"response": response, "node_id": next_node.get("id")}

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

    def _execute_node(self, node, workflow, user_input, conversation_history, target_language=None, agent=None):
        node_type = node.get("type")
        node_data = node.get("data", {})
        if node_type == "begin":
            nxt = self._find_next_node(node, workflow)
            if nxt:
                return self._execute_node(nxt, workflow, user_input, conversation_history, target_language, agent)
            return "Error: No nodes after BEGIN"
        elif node_type == "dialogue":
            return self._execute_dialogue_node(node_data, user_input, conversation_history, target_language, agent)
        elif node_type == "action":
            return self._execute_action_node(node_data)
        elif node_type == "condition":
            return self._execute_condition_node(node_data, user_input)
        return f"Node type '{node_type}' not supported"

    def _execute_dialogue_node(self, node_data, user_input, conversation_history, target_language=None, agent=None):
        """Execute a dialogue node — tries the agent's chosen LLM provider, then falls back
        to Gemini (the one provider we can reasonably assume has a free-tier key available)."""
        response_type = node_data.get("responseType", "llm")
        if response_type == "static":
            return node_data.get("staticText", "") or "No static text configured"

        prompt = node_data.get("prompt", "You are a helpful assistant.")

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


# Global instance
workflow_engine = WorkflowEngine()
