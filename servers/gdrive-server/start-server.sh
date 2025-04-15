#!/bin/bash

# Start the GDrive MCP Server
cd "$(dirname "$0")"
python -m mcp_server_gdrive
