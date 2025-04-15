# MCP Unix Socket Server with Socket.IO

This is a persistent MCP (Model Context Protocol) server that runs on your Mac using Unix sockets. It provides both traditional SSE-based communication and modern Socket.IO real-time capabilities.

## Overview

- **Server Location**: `~/Library/Application Support/MCP/server`
- **Socket Path**: `~/Library/Application Support/MCP/mcp-server.sock`
- **Data Storage**: `~/Library/Application Support/MCP/data`
- **Logs**: `~/Library/Application Support/MCP/logs`

## Features

- Runs as a persistent LaunchAgent (always on, auto-restarts)
- Uses Unix sockets instead of ports (no port conflicts)
- Supports both SSE and Socket.IO for real-time communication
- Provides basic file operations (read, write, list)
- Offers easy Node.js integration

## Using the CLI

The MCP client is available as a command-line tool:

```bash
# Basic commands
mcp echo "Hello, world!"
mcp write test.txt "This is a test file"
mcp read test.txt
mcp list

# Or use aliases
mcp-echo "Hello, world!"
mcp-write test.txt "This is a test file"
mcp-read test.txt
mcp-list
```

## Using in Node.js Applications

```javascript
import mcp from '~/Library/Application Support/MCP/index.js';

// Use the MCP client
async function example() {
  try {
    // Echo
    const result = await mcp.echo("Hello from Node.js");
    console.log(result);
    
    // Write a file
    await mcp.files.write("app-data.json", JSON.stringify({ key: "value" }));
    
    // Read a file
    const content = await mcp.files.read("app-data.json");
    console.log(JSON.parse(content));
    
    // List files
    const files = await mcp.files.list();
    console.log(files);
    
    // Clean up
    mcp.disconnect();
  } catch (error) {
    console.error(error);
  }
}

example();
```

## Socket.IO Integration

To use Socket.IO in your applications:

```javascript
import { io } from 'socket.io-client';
import net from 'net';

// Create a Socket.IO client connected to the Unix socket
const socket = io('http://localhost', {
  path: '/socket.io',
  transports: ['websocket'],
  agent: new net.Agent({ 
    socketPath: '~/Library/Application Support/MCP/mcp-server.sock' 
  })
});

// Connect to the server
socket.on('connect', () => {
  console.log('Connected to MCP server via Socket.IO');
  
  // Call the echo tool
  socket.emit('mcpMessage', {
    type: 'callTool',
    id: '1',
    params: {
      name: 'echo',
      arguments: {
        message: 'Hello via Socket.IO!'
      }
    }
  });
});

// Handle responses
socket.on('mcpResponse', (response) => {
  console.log('Received response:', response);
});
```

## Server Management

```bash
# View server logs
cat ~/Library/Application\ Support/MCP/logs/server.log

# Check server status
curl --unix-socket ~/Library/Application\ Support/MCP/mcp-server.sock http://localhost/health

# Restart the server
launchctl unload ~/Library/LaunchAgents/com.user.mcp.universal.plist
launchctl load -w ~/Library/LaunchAgents/com.user.mcp.universal.plist
```

## Socket Path

The Unix socket is located at:
```
~/Library/Application Support/MCP/mcp-server.sock
```

Applications can connect to this socket to communicate with the MCP server.
