"""MCP server exposing Gazebo world and mission controls to Claude.

Skeleton only — concrete tool implementations land in brickbot_mcp.tools.*
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

log = logging.getLogger("brickbot_mcp")

server = Server("brickbot-mcp")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="list_models",
            description="List all models currently in the Gazebo world.",
            inputSchema={"type": "object", "properties": {}},
        ),
        Tool(
            name="spawn_model",
            description="Spawn a model from a URI (Fuel or local path) at a given pose.",
            inputSchema={
                "type": "object",
                "properties": {
                    "uri": {"type": "string"},
                    "name": {"type": "string"},
                    "x": {"type": "number"}, "y": {"type": "number"}, "z": {"type": "number"},
                },
                "required": ["uri", "name"],
            },
        ),
        Tool(
            name="mission_start",
            description="Start the build_wall mission with the current world state.",
            inputSchema={"type": "object", "properties": {}},
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    # TODO: dispatch to brickbot_mcp.tools.<name>
    return [TextContent(type="text", text=f"[stub] {name}({arguments})")]


async def _run() -> None:
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_run())


if __name__ == "__main__":
    main()
