// MCP Library for Node.js applications
// This module provides easy access to the MCP server

import MCPSocketIOClient from './mcp-socketio-client.js';
import fs from 'fs';
import path from 'path';

// Define the Unix Socket path
const HOME_DIR = process.env.HOME || '/tmp';
const APP_SUPPORT_DIR = path.join(HOME_DIR, 'Library/Application Support/MCP');
const SOCKET_PATH = path.join(HOME_DIR, 'Library/Application Support/MCP/mcp-server.sock');
const DATA_DIR = path.join(APP_SUPPORT_DIR, 'data');

// MCP singleton client
let mcpClient = null;

// Connect to MCP server
async function connect() {
  if (mcpClient && mcpClient.connected) {
    return mcpClient;
  }
  
  mcpClient = new MCPSocketIOClient(SOCKET_PATH);
  await mcpClient.connect();
  return mcpClient;
}

// Safely disconnect
function disconnect() {
  if (mcpClient) {
    mcpClient.disconnect();
    mcpClient = null;
  }
}

// High-level API
const mcp = {
  // Echo tool wrapper
  echo: async (message) => {
    const client = await connect();
    try {
      const result = await client.callTool('echo', { message });
      return result.content[0].text;
    } catch (error) {
      console.error('Echo error:', error);
      throw error;
    }
  },
  
  // File operations
  files: {
    // Write a file
    write: async (path, content) => {
      const client = await connect();
      try {
        const result = await client.callTool('writeFile', { path, content });
        return result.content[0].text;
      } catch (error) {
        console.error('Write error:', error);
        throw error;
      }
    },
    
    // Read a file
    read: async (path) => {
      const client = await connect();
      try {
        const result = await client.callTool('readFile', { path });
        return result.content[0].text;
      } catch (error) {
        console.error('Read error:', error);
        throw error;
      }
    },
    
    // List files in a directory
    list: async (directory = '') => {
      const client = await connect();
      try {
        const result = await client.callTool('listFiles', { directory });
        return JSON.parse(result.content[0].text);
      } catch (error) {
        console.error('List error:', error);
        throw error;
      }
    }
  },
  
  // Direct tool access
  callTool: async (name, args) => {
    const client = await connect();
    return client.callTool(name, args);
  },
  
  // Get server info
  getServerInfo: async () => {
    const client = await connect();
    return client.getServerInfo();
  },
  
  // List available tools
  listTools: async () => {
    const client = await connect();
    return client.listTools();
  },
  
  // Clean up
  disconnect
};

// Export the MCP API
export default mcp;
