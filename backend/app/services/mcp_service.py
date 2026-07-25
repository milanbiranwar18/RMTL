"""Minimal, dependency-free MCP (Model Context Protocol, https://modelcontextprotocol.io) client
— speaks the "Streamable HTTP" transport (JSON-RPC 2.0 over plain HTTP POST) using the same
synchronous `httpx` already used for every other outbound call in this codebase (Anthropic/
Gemini/Sarvam LLM calls and the Custom Function node in workflow_engine.py, all four telephony
providers in telephony_service.py).

Deliberately NOT built on the official `mcp` PyPI SDK: that SDK is async-only and requires Python
3.10+, while this backend's venv is pinned to 3.9 and the workflow engine is synchronous
throughout — bridging the two (a thread-per-call event loop, or bumping the whole backend's
Python version) would add real complexity for no functional gain, since the actual wire protocol
implemented below is plain JSON-RPC and easy to speak directly.

Each call here does its own fresh initialize handshake rather than keeping an MCP session alive
across requests — this backend is stateless per HTTP request already (no long-lived connections
anywhere else either: `telephony_service.py` and every LLM call open a fresh connection every
time), and a remote MCP server's `tools/list`/`tools/call` are cheap, infrequent, mid-conversation
operations, not a hot path — so the extra round trip is a fine trade for the simplicity.
"""

import json
import logging
import uuid
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_PROTOCOL_VERSION = "2025-06-18"


class MCPError(Exception):
    pass


def _headers(auth_header: Optional[str], session_id: Optional[str] = None) -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    if auth_header:
        headers["Authorization"] = (
            auth_header if auth_header.lower().startswith(("bearer ", "basic ")) else f"Bearer {auth_header}"
        )
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    return headers


def _parse_response(resp: httpx.Response) -> Optional[dict]:
    """Handles both a plain JSON body and a (possibly multi-event) SSE stream — an MCP server
    over Streamable HTTP is allowed to answer either way. For a simple request/response exchange
    like everything this module does, we just want the JSON-RPC payload from the last `data:`
    event, which is the actual response to our request."""
    if not resp.content:
        return None
    content_type = resp.headers.get("content-type", "")
    if "text/event-stream" in content_type:
        last_data = None
        for line in resp.text.splitlines():
            if line.startswith("data:"):
                last_data = line[len("data:"):].strip()
        return json.loads(last_data) if last_data else None
    return resp.json()


def _rpc_call(url: str, method: str, params: dict, session_id: Optional[str], auth_header: Optional[str], timeout: float):
    """Sends one JSON-RPC *request* (has an `id`, expects a response). Returns
    `(result, response_session_id)`."""
    payload = {"jsonrpc": "2.0", "id": str(uuid.uuid4()), "method": method, "params": params}
    resp = httpx.post(url, json=payload, headers=_headers(auth_header, session_id), timeout=timeout)
    resp.raise_for_status()
    new_session_id = resp.headers.get("mcp-session-id") or session_id
    data = _parse_response(resp)
    if not data:
        return None, new_session_id
    if "error" in data:
        raise MCPError(data["error"].get("message", "MCP server returned an error"))
    return data.get("result"), new_session_id


def _rpc_notify(url: str, method: str, params: dict, session_id: Optional[str], auth_header: Optional[str], timeout: float) -> None:
    """Sends a JSON-RPC *notification* (no `id`, no response body expected — just a 202/204)."""
    payload = {"jsonrpc": "2.0", "method": method, "params": params}
    httpx.post(url, json=payload, headers=_headers(auth_header, session_id), timeout=timeout)


def _handshake(url: str, auth_header: Optional[str], timeout: float) -> Optional[str]:
    """Every MCP session starts with `initialize` (client <-> server capability exchange) then a
    `notifications/initialized` notification confirming the client is ready — required by the
    spec before any real tool call. Returns the session id (if the server assigned one via the
    `Mcp-Session-Id` response header) to reuse for the one real call that follows."""
    result, session_id = _rpc_call(
        url, "initialize",
        {
            "protocolVersion": _PROTOCOL_VERSION,
            "capabilities": {},
            "clientInfo": {"name": "rmtl-voice-platform", "version": "1.0"},
        },
        None, auth_header, timeout,
    )
    if result is None:
        raise MCPError("MCP server did not respond to initialize")
    _rpc_notify(url, "notifications/initialized", {}, session_id, auth_header, timeout)
    return session_id


def list_mcp_tools(server_url: str, auth_header: Optional[str] = None, timeout: float = 15) -> list:
    """Returns `[{"name", "description", "input_schema"}, ...]` — powers the "Load Tools" picker
    in the workflow builder's MCP Tool Call node, so picking a real tool (and seeing its schema)
    never requires knowing the MCP protocol at all. Raises MCPError/httpx errors on failure —
    the caller (routers/mcp.py) turns that into a clean 400 for the UI to show."""
    session_id = _handshake(server_url, auth_header, timeout)
    result, _ = _rpc_call(server_url, "tools/list", {}, session_id, auth_header, timeout)
    tools = (result or {}).get("tools", [])
    return [
        {"name": t.get("name"), "description": t.get("description", ""), "input_schema": t.get("inputSchema", {})}
        for t in tools
        if t.get("name")
    ]


def call_mcp_tool(server_url: str, tool_name: str, arguments: dict, auth_header: Optional[str] = None, timeout: float = 30) -> dict:
    """Returns `{"success", "text", "structured", "error"}`. Never raises — a broken/unreachable
    MCP server should degrade the same way a failed Custom Function call does (see
    workflow_engine.py's `_execute_custom_function_node`), not break the conversation."""
    try:
        session_id = _handshake(server_url, auth_header, timeout)
        result, _ = _rpc_call(
            server_url, "tools/call", {"name": tool_name, "arguments": arguments or {}}, session_id, auth_header, timeout
        )
        result = result or {}
        text_parts = [
            block.get("text", "") for block in result.get("content", []) if isinstance(block, dict) and block.get("type") == "text"
        ]
        return {
            "success": not result.get("isError", False),
            "text": "\n".join(p for p in text_parts if p),
            "structured": result.get("structuredContent"),
            "error": None,
        }
    except Exception as e:
        logger.warning(f"MCP tool call '{tool_name}' on {server_url} failed: {e}")
        return {"success": False, "text": "", "structured": None, "error": str(e)[:200]}
