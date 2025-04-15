#!/bin/bash

# Start the Fetch MCP Server
cd "$(dirname "$0")"
python -m mcp_server_fetch
