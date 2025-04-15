// Register with Memory Server and Send Message to Cline
import { io } from 'socket.io-client';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MCP_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';
const MEMORY_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock';

// Check if sockets exist
if (!fs.existsSync(MCP_SOCKET_PATH)) {
  console.error(`Error: MCP Socket not found at ${MCP_SOCKET_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(MEMORY_SOCKET_PATH)) {
  console.error(`Error: Memory Socket not found at ${MEMORY_SOCKET_PATH}`);
  process.exit(1);
}

// Agent configuration
const agent = {
  id: 'athena_agent',
  name: 'Athena',
  type: 'assistant',
  description: 'AI assistant for development tasks',
  capabilities: ['text', 'function_call', 'memory_access'],
  metadata: {
    creator: 'Gabriel McPherson',
    version: '1.0.0',
    created: new Date().toISOString(),
    permanent: true
  }
};

// Message to send
const message = {
  content: 'Hello Cline! This is a message from Athena.',
  recipients: ['cline']
};

// Connect to memory server and register
async function registerWithMemoryServer() {
  return new Promise((resolve, reject) => {
    console.log('Connecting to memory server...');
    
    const client = net.createConnection({ path: MEMORY_SOCKET_PATH }, () => {
      console.log('Connected to memory server');
      
      // Create registration request
      const request = {
        operation: 'store_entity',
        params: {
          entity: {
            ...agent,
            lastActive: new Date().toISOString()
          },
          context: 'system'
        }
      };
      
      console.log('Sending registration request:', JSON.stringify(request, null, 2));
      client.write(JSON.stringify(request) + '\n');
    });
    
    let buffer = '';
    client.on('data', (data) => {
      buffer += data.toString();
      console.log('Received data chunk:', data.toString());
      
      try {
        const response = JSON.parse(buffer);
        console.log('Registration response:', JSON.stringify(response, null, 2));
        client.end();
        resolve(response);
      } catch (error) {
        // Incomplete JSON, wait for more data
      }
    });
    
    client.on('error', (error) => {
      console.error('Memory server connection error:', error);
      reject(error);
    });
    
    client.on('end', () => {
      console.log('Disconnected from memory server');
      if (buffer && !buffer.includes('{')) {
        reject(new Error('Invalid response from memory server'));
      }
    });
    
    // Add timeout
    setTimeout(() => {
      if (client.connecting) {
        client.end();
        reject(new Error('Connection timeout'));
      }
    }, 5000);
  });
}

// Connect to MCP server and send message
async function sendMessageToCline() {
  return new Promise((resolve, reject) => {
    console.log('Connecting to MCP server via Socket.IO...');
    
    // Create Socket.IO client
    const socket = io('http://localhost', {
      path: '/socket.io',
      transports: ['websocket'],
      agent: new net.Agent({ 
        socketPath: MCP_SOCKET_PATH 
      })
    });
    
    // Set up event handlers
    socket.on('connect', () => {
      console.log('Connected to MCP server via Socket.IO');
      
      // Call the sendMessage tool
      const request = {
        type: 'callTool',
        id: Date.now().toString(),
        params: {
          name: 'sendMessage',
          arguments: {
            sender: agent.id,
            recipients: message.recipients,
            content: message.content,
            timestamp: new Date().toISOString()
          }
        }
      };
      
      console.log('Sending message request:', JSON.stringify(request, null, 2));
      socket.emit('mcpMessage', request);
    });
    
    socket.on('mcpResponse', (response) => {
      console.log('Received response:', JSON.stringify(response, null, 2));
      socket.disconnect();
      resolve(response);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      reject(error);
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
      reject(error);
    });
    
    // Add timeout
    setTimeout(() => {
      if (socket.connected) {
        socket.disconnect();
        reject(new Error('Response timeout'));
      }
    }, 10000);
  });
}

// Main function
async function main() {
  try {
    console.log('Starting registration and message process...');
    
    // Step 1: Register with memory server
    console.log('\n=== Step 1: Register with Memory Server ===');
    const registrationResult = await registerWithMemoryServer();
    console.log('Registration completed:', registrationResult);
    
    // Step 2: Send message to Cline
    console.log('\n=== Step 2: Send Message to Cline ===');
    const messageResult = await sendMessageToCline();
    console.log('Message sent:', messageResult);
    
    console.log('\nProcess completed successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main();
