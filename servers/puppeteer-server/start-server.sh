#!/bin/bash

# Start the Puppeteer MCP Server
cd "$(dirname "$0")"
python -m mcp_server_puppeteer
