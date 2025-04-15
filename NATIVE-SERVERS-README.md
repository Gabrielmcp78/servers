# MCP Native Servers

This package ensures that all native MCP servers (MCP, memory, communication) are running from the `/Users/gabrielmcp/Library/Application Support/MCP` directory.

## Installation

To install the native servers and configure them to start automatically at login:

```bash
node install-native-servers.js
```

This will:
1. Copy the startup script to the MCP directory
2. Create a LaunchAgent to start the servers at login
3. Start the servers immediately

## Manual Usage

You can manually control the servers using the following commands:

```bash
# Start all servers
node /Users/gabrielmcp/Library/Application\ Support/MCP/mcp-native-servers.js start

# Stop all servers
node /Users/gabrielmcp/Library/Application\ Support/MCP/mcp-native-servers.js stop

# Restart all servers
node /Users/gabrielmcp/Library/Application\ Support/MCP/mcp-native-servers.js restart

# Check server status
node /Users/gabrielmcp/Library/Application\ Support/MCP/mcp-native-servers.js status
```

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

## Uninstalling

To uninstall:

```bash
# Unload the LaunchAgent
launchctl unload -w ~/Library/LaunchAgents/com.mcp.native-servers.plist

# Remove the LaunchAgent
rm ~/Library/LaunchAgents/com.mcp.native-servers.plist

# Stop the servers
node /Users/gabrielmcp/Library/Application\ Support/MCP/mcp-native-servers.js stop
```
