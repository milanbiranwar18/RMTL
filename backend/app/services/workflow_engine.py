from openai import OpenAI
from app.config import settings
import logging
import os
import httpx

logger = logging.getLogger(__name__)


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


class WorkflowEngine:
    def __init__(self):
        api_key = settings.OPENAI_API_KEY
        if api_key:
            masked = api_key[:8] + "***" + api_key[-4:] if len(api_key) > 12 else "***"
            logger.info(f"WorkflowEngine init: OpenAI key={masked}")
        else:
            logger.warning("WorkflowEngine init: OpenAI key is EMPTY")
        self.client = OpenAI(api_key=api_key)
        # Circuit breaker: True once OpenAI returns quota-exceeded
        self.openai_quota_exceeded = False

    def _get_gemini_key(self) -> str:
        """Read Gemini key fresh — checks env var first, then settings."""
        return os.environ.get("GEMINI_API_KEY", "").strip() or settings.GEMINI_API_KEY or ""

    def execute_workflow(self, workflow, user_input: str, conversation_history: list = None, current_node_id: str = None):
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

        response = self._execute_node(next_node, workflow, user_input, conversation_history, target_language)
        return {"response": response, "node_id": next_node.get("id")}

    def _find_start_node(self, nodes):
        for node in nodes:
            if node.get("type") == "begin":
                return node
        return None

    def _find_next_node(self, current_node, workflow, user_input=None):
        current_id = current_node.get("id")
        conditions = current_node.get("data", {}).get("conditions", [])
        print(f"DEBUG: Node {current_id} conditions: {conditions} | input: '{user_input}'")

        for i, condition in enumerate(conditions):
            label = condition.get("label", "").lower()
            pattern = condition.get("pattern", "").lower()
            match = False
            if pattern and user_input and pattern in user_input.lower():
                match = True
            elif label and user_input and label in user_input.lower():
                match = True
            print(f"DEBUG: Condition {i}: label='{label}', pattern='{pattern}' -> {match}")
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
        print(f"DEBUG: No edge found from {current_id}")
        return None

    def _get_node_by_id(self, node_id, workflow):
        for node in workflow.get("nodes", []):
            if node.get("id") == node_id:
                return node
        return None

    def _execute_node(self, node, workflow, user_input, conversation_history, target_language=None):
        node_type = node.get("type")
        node_data = node.get("data", {})
        if node_type == "begin":
            nxt = self._find_next_node(node, workflow)
            if nxt:
                return self._execute_node(nxt, workflow, user_input, conversation_history, target_language)
            return "Error: No nodes after BEGIN"
        elif node_type == "dialogue":
            return self._execute_dialogue_node(node_data, user_input, conversation_history, target_language)
        elif node_type == "action":
            return self._execute_action_node(node_data)
        elif node_type == "condition":
            return self._execute_condition_node(node_data, user_input)
        return f"Node type '{node_type}' not supported"

    def _execute_dialogue_node(self, node_data, user_input, conversation_history, target_language=None):
        """Execute a dialogue node — tries OpenAI then falls back to Gemini."""
        response_type = node_data.get("responseType", "llm")
        if response_type == "static":
            return node_data.get("staticText", "") or "No static text configured"

        prompt = node_data.get("prompt", "You are a helpful assistant.")
        print(f"DEBUG: Dialogue node | prompt='{prompt}' | lang={target_language} | quota_exceeded={self.openai_quota_exceeded}")

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

        gemini_key = self._get_gemini_key()
        logger.info(f"LLM: gemini_key={'set' if gemini_key else 'MISSING'}, openai_key={'set' if settings.OPENAI_API_KEY else 'MISSING'}")

        # PRIMARY: OpenAI
        if not self.openai_quota_exceeded and settings.OPENAI_API_KEY:
            try:
                response = self.client.chat.completions.create(
                    model="gpt-4o",
                    messages=messages,
                    temperature=0.7,
                    max_tokens=150
                )
                text = response.choices[0].message.content
                print(f"DEBUG: OpenAI response: '{text}'")
                return text
            except Exception as e:
                err = str(e)
                is_quota = (
                    "insufficient_quota" in err
                    or "429" in err
                    or "quota" in err.lower()
                    or "RateLimitError" in type(e).__name__
                )
                if is_quota:
                    self.openai_quota_exceeded = True
                    logger.warning(f"OpenAI quota exceeded — circuit breaker ON. Switching to Gemini.")
                else:
                    logger.error(f"OpenAI error (non-quota): {err}")
                
                # Fall through to Gemini
        elif not settings.OPENAI_API_KEY:
            logger.warning("No OpenAI key configured — skipping to Gemini")
        elif self.openai_quota_exceeded:
            logger.warning("OpenAI circuit breaker active — skipping to Gemini")

        # FALLBACK: Gemini
        logger.info("Using Gemini 2.5 Flash")
        return self._call_gemini_safe(messages, gemini_key)

    def _call_gemini_safe(self, messages: list, gemini_key: str) -> str:
        """Call Gemini with proper error handling."""
        if not gemini_key:
            logger.error("No Gemini API key available!")
            return "Error: No Gemini API key set."
        try:
            text = _call_gemini(messages, gemini_key)
            print(f"DEBUG: Gemini response: '{text}'")
            return text
        except Exception as e:
            logger.error(f"Gemini failed: {e}")
            return f"Error: Gemini failed — {e}"

    def _execute_action_node(self, node_data):
        return f"Executed action: {node_data.get('functionName', 'unknown')}"

    def _execute_condition_node(self, node_data, user_input):
        return f"Evaluated condition: {node_data.get('condition', '')}"


# Global instance
workflow_engine = WorkflowEngine()
