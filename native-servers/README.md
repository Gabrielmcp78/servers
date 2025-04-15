# MCP Native Servers

This extension integrates with the native MCP servers located in `/Users/gabrielmcp/Library/Application Support/MCP` instead of using the other server implementation.

## Features

- Start, stop, and restart the native MCP servers
- Monitor server status in the VS Code status bar
- View server statistics (entity count, relation count, message count)
- Configure servers to start automatically at login

## Installation

The extension will automatically install the native server scripts when you first use it. You can also manually install them by clicking the "Install Native Servers" button in the MCP dashboard.

## Server Details

The following native servers are managed:

1. **MCP Server**
   - Script: `/Users/gabrielmcp/Library/Application Support/MCP/server/mcp-server.js`
   - Socket: `/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock`
   - Log: `/Users/gabrielmcp/Library/Application Support/MCP/logs/mcp-server.log`

2. **Memory Server**
   - Script: `/Users/gabrielmcp/Library/Application Support/MCP/memory-server-main.js`
   - Socket: `/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock`
   - Log: `/Users/gabrielmcp/Library/Application Support/MCP/logs/memory-server.log`

3. **Communication Server**
   - Script: `/Users/gabrielmcp/Library/Application Support/MCP/comms/comms-server.js`
   - Socket: `/Users/gabrielmcp/Library/Application Support/MCP/comms-server.sock`
   - Log: `/Users/gabrielmcp/Library/Application Support/MCP/logs/comms-server.log`

## Logs

All server logs are stored in the `/Users/gabrielmcp/Library/Application Support/MCP/logs` directory.

## Troubleshooting

If you encounter issues:

1. Check the server logs in the logs directory
2. Ensure the socket files exist when servers are running
3. Try restarting the servers with the restart command
4. Check the LaunchAgent logs at:
   - `/Users/gabrielmcp/Library/Application Support/MCP/logs/launchd.log`
   - `/Users/gabrielmcp/Library/Application Support/MCP/logs/launchd-error.log`
