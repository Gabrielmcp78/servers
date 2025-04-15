// Test direct Socket.IO client for MCP server
import { io } from 'socket.io-client';
import net from 'net';

// Define the Unix Socket path
const SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';

// Connect using Socket.IO
console.log(`Connecting to MCP server at socket path: ${SOCKET_PATH}`);
const socket = io('http://unix:' + SOCKET_PATH, {
  path: '/socket.io',
  transports: ['polling', 'websocket'], // Try polling first, then websocket
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
  extraHeaders: {
    'Connection': 'keep-alive',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Set up event handlers
socket.on('connect', () => {
  console.log('Connected to MCP server via Socket.IO');

  // Test echo tool
  console.log('Sending echo message...');
  const message = {
    type: 'callTool',
    id: Date.now().toString(),
    params: {
      name: 'echo',
      arguments: {
        message: 'Hello from direct Socket.IO client!'
      }
    }
  };

  socket.emit('mcpMessage', message);
});

socket.on('disconnect', () => {
  console.log('Disconnected from MCP server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('mcpResponse', (response) => {
  console.log('Received response:', response);

  // Disconnect after receiving the response
  setTimeout(() => {
    console.log('Test completed, disconnecting...');
    socket.disconnect();
  }, 1000);
});

// Connect to the server
console.log('Initiating connection to server...');
socket.connect();
