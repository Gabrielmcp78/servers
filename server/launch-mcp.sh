#!/bin/bash

# Set up paths
MCP_DIR="$HOME/Library/Application Support/MCP"
SERVER_DIR="$MCP_DIR/server"
LOG_DIR="$MCP_DIR/logs"
SOCKET_PATH="$MCP_DIR/mcp-server.sock"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Log startup
echo "Starting MCP server at $(date)" >> "$LOG_DIR/startup.log" 

# If socket exists but no process is using it, remove it
if [ -S "$SOCKET_PATH" ]; then
  if ! lsof "$SOCKET_PATH" > /dev/null 2>&1; then
    rm "$SOCKET_PATH"
    echo "Removed stale socket file" >> "$LOG_DIR/startup.log"
  fi
fi

# Start the server
cd "$SERVER_DIR"
exec /usr/bin/env node mcp-server.js
