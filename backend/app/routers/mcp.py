import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import mcp_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp", tags=["mcp"])


class ListToolsRequest(BaseModel):
    server_url: str
    auth_header: Optional[str] = None


@router.post("/list-tools")
def list_tools(request: ListToolsRequest):
    """Powers the "Load Tools" button on the MCP Tool Call node in the workflow builder — lets
    someone pick a real tool (and see its input schema) from any MCP server without ever touching
    the protocol directly."""
    try:
        tools = mcp_service.list_mcp_tools(request.server_url, request.auth_header)
        return {"success": True, "tools": tools}
    except Exception as e:
        logger.warning(f"Failed to list MCP tools from {request.server_url}: {e}")
        raise HTTPException(status_code=400, detail=f"Couldn't connect to that MCP server: {str(e)[:300]}")
