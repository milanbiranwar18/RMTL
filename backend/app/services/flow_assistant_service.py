""""Conductor"-style AI assistant for the Workflow Builder — the user describes what they want in
plain English ("add a node that transfers to +1 555 123 4567 if the caller says they want a
refund") and an LLM proposes a small set of structured graph operations (add/update/delete a
node, add/delete an edge) which the frontend applies to the live ReactFlow canvas. Deliberately
NOT "regenerate the whole graph" — for anything but a brand-new flow, asking the model to emit
every existing node back verbatim just to add one more is both wasteful and a good way to
silently lose/mutate something it wasn't asked to touch. Small, auditable operations instead.

BYOK: reuses the exact same `_try_llm_provider` (agent's own key -> owner's Integrations vault ->
platform key, see key_resolver.py) every other LLM-assisted node in `workflow_engine.py` already
uses — the assistant runs on whichever agent is currently selected in the builder (or the
platform-wide fallback key if none is selected yet).
"""

import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# Sent to the LLM verbatim as part of the system prompt — keep this in sync with the node `data`
# shapes actually read by NodePropertiesPanel.jsx / workflow_engine.py whenever a node type's
# fields change, or the assistant will start proposing configs the rest of the app can't read.
NODE_SCHEMA_REFERENCE = """
Each node has: id (string), type (one of the types below), data (object — shape depends on
type), position ({x, y} — pick reasonable canvas coordinates, spaced ~200px apart, that don't
overlap existing nodes).

Node types and their `data` shape:
- "begin": {label}. There is always exactly one, already on the canvas — never add another one.
- "dialogue": {label, responseType: "llm"|"static", prompt (system prompt, if responseType=="llm"),
  staticText (exact text to speak, if responseType=="static"), conditions: [{label, pattern}]}.
  Each entry in `conditions` gets its own outgoing edge with sourceHandle "condition-<index>"
  (0-based) — used when the next node depends on keywords in what the caller said.
- "logic_split": {label, branches: [{variable, operator: "equals"|"not_equals"|"contains"|
  "greater_than"|"less_than", value}]}. Routes on a previously-set *variable* (from Extract
  Variable/Code/Custom Function/MCP Tool Call, or a call-time dynamic variable), NOT on the
  caller's literal words. Each branch gets sourceHandle "branch-<index>"; there is always also a
  "default" handle (sourceHandle: "default") for when nothing matches.
- "extract_variable": {label, variables: [{name, description}]}. Silently asks the LLM to pull
  named fields out of the conversation so far into variables. No branching of its own — one plain
  outgoing edge (no sourceHandle).
- "code": {label, expression (simple arithmetic/comparison, e.g. "price * quantity"),
  outputVariable}. One plain outgoing edge.
- "custom_function": {name, description, method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE", url
  (supports {{variable}} templating), headers: [{key, value}], body (JSON string, supports
  {{variable}}), timeoutSeconds, outputs: [{variable, path (dot-path into the JSON response, e.g.
  "current.temperature")}]}. Calls a real HTTP API. Auto-sets "<name>_success"/"<name>_error"
  variables — pair with a Logic Split on those to branch on failure. One plain outgoing edge.
- "mcp_tool_call": {label, serverUrl, authHeader, toolName, toolDescription, toolInputSchema
  (JSON schema object), outputVariable}. Calls a tool on an MCP server. Only propose this if the
  user gives you a real server URL and tool name/schema — never invent one. One plain outgoing edge.
- "call_transfer": {label, transferNumber, message (spoken before transferring)}. Ends the flow.
- "press_digit": {label, digits (e.g. "1" or "4321#"), message}. Sends DTMF tones. One plain edge.
- "in_call_sms": {label, message (supports {{variable}}), confirmationMessage}. One plain edge.
- "agent_transfer": {label, targetAgentId (integer — only use an id the user gave you or that
  appears in "Other agents available" below), message}. One plain edge.
- "ending": {label, endMessage (supports {{variable}})}. Ends the flow, no outgoing edges.
- "note": {text}. Pure visual annotation, never has any edges at all.
- "action" / "condition": legacy node types — do not create new ones of these, only "dialogue"
  going forward covers what they used to do.

Edges: {id, source (node id), target (node id), sourceHandle (omit entirely for a node's single
plain outgoing edge; use the conventions above for dialogue/logic_split)}.
"""

_SYSTEM_PROMPT_TEMPLATE = """You are a workflow-building assistant embedded in a visual voice-AI
call flow builder (similar to a phone tree / IVR designer). The user describes what they want in
plain English; you respond with a small, precise set of graph operations to make it happen —
never regenerate the whole graph, only the minimal add/update/delete operations needed.
{schema}
{agents_note}
Current graph (nodes and edges already on the canvas):
{graph}

Respond with ONLY a single compact JSON object, no markdown fences, no commentary outside the
JSON, in exactly this shape:
{{"reply": "<one short sentence in plain English summarizing what you did or, if you couldn't do
what was asked, why not>", "operations": [
  {{"op": "add_node", "node": {{"id": "<a short id you invent, e.g. 'refund-transfer'>", "type": "...", "data": {{...}}, "position": {{"x": 0, "y": 0}}}}}},
  {{"op": "update_node", "id": "<existing or just-added node id>", "data": {{...fields to merge in...}}}},
  {{"op": "delete_node", "id": "<existing node id>"}},
  {{"op": "add_edge", "edge": {{"id": "<a short id you invent>", "source": "<node id>", "target": "<node id>", "sourceHandle": "<optional, see conventions above>"}}}},
  {{"op": "delete_edge", "id": "<existing edge id>"}}
]}}
If the request is unclear, ambiguous, or you genuinely can't do it (e.g. asks for a node type
that doesn't exist), return an empty "operations" array and explain why in "reply" — never guess
wildly or invent something not described above."""


def _graph_summary(nodes: list, edges: list) -> str:
    trimmed_nodes = [{"id": n.get("id"), "type": n.get("type"), "data": n.get("data", {})} for n in (nodes or [])]
    trimmed_edges = [
        {"id": e.get("id"), "source": e.get("source"), "target": e.get("target"), "sourceHandle": e.get("sourceHandle")}
        for e in (edges or [])
    ]
    return json.dumps({"nodes": trimmed_nodes, "edges": trimmed_edges}, indent=None)


def generate_operations(
    nodes: list, edges: list, message: str, conversation_history: Optional[list], agent, other_agents: Optional[list] = None
) -> dict:
    """Returns {"reply": str, "operations": list}. Never raises — a malformed/failed LLM response
    just comes back as an empty operations list with an explanatory `reply`, same "degrade
    gracefully" convention as every other LLM-assisted piece of this workflow engine."""
    from app.services.workflow_engine import workflow_engine, DEFAULT_MODEL_BY_PROVIDER

    agents_note = ""
    if other_agents:
        agents_note = "Other agents available for Agent Transfer nodes: " + ", ".join(
            f"id={a.get('id')} name=\"{a.get('name')}\"" for a in other_agents
        ) + "\n"

    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(
        schema=NODE_SCHEMA_REFERENCE, agents_note=agents_note, graph=_graph_summary(nodes, edges)
    )
    messages = [{"role": "system", "content": system_prompt}]
    for msg in (conversation_history or [])[-10:]:
        role = "assistant" if msg.get("role") == "assistant" else "user"
        messages.append({"role": role, "content": msg.get("content", "")})
    messages.append({"role": "user", "content": message})

    provider = (getattr(agent, "llm_provider", None) if agent else None) or "gpt"
    model = (getattr(agent, "llm_model", None) if agent else None) or DEFAULT_MODEL_BY_PROVIDER.get(provider, "gpt-4o")

    text = workflow_engine._try_llm_provider(provider, model, messages, agent)
    if not text:
        return {"reply": "I couldn't reach an LLM to process that — check that an API key is configured (Agent Settings or Integrations).", "operations": []}

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {"reply": "I didn't understand how to do that — could you rephrase?", "operations": []}
    try:
        parsed = json.loads(match.group(0))
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"Flow assistant: failed to parse LLM response as JSON: {e}")
        return {"reply": "Something went wrong parsing that request — could you try rephrasing it?", "operations": []}

    operations = parsed.get("operations")
    if not isinstance(operations, list):
        operations = []
    reply = parsed.get("reply") or ("Done." if operations else "I didn't make any changes.")
    return {"reply": reply, "operations": operations}
