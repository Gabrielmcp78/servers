#!/bin/bash

# Create MCP directory structure
MCP_BASE_DIR="$HOME/Library/Application Support/MCP"
mkdir -p "$MCP_BASE_DIR/logs"
mkdir -p "$MCP_BASE_DIR/data"
mkdir -p "$MCP_BASE_DIR/servers/software-planning-mcp"

echo "Created MCP directory structure at $MCP_BASE_DIR"
