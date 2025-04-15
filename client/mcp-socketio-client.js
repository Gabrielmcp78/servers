// MCP HTTP Client
// This client connects to the MCP server via Unix socket using HTTP and SSE

import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

// Define the Unix Socket path
const HOME_DIR = process.env.HOME || '/tmp';
const APP_SUPPORT_DIR = path.join(HOME_DIR, 'Library/Application Support/MCP');
const SOCKET_PATH = path.join(APP_SUPPORT_DIR, 'mcp-server.sock');

// Check if socket exists
if (!fs.existsSync(SOCKET_PATH)) {
  console.error(`Error: Socket not found at ${SOCKET_PATH}`);
  console.error('Make sure the MCP server is running.');
  process.exit(1);
}

class MCPSocketIOClient {
  constructor(socketPath) {
    this.socketPath = socketPath;
    this.socket = null;
    this.connected = false;
    this.responseListeners = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to MCP server at socket path: ${this.socketPath}`);

      // Create SSE connection
      this.sessionId = Math.random().toString(36).substring(2, 15);
      console.log(`Session ID: ${this.sessionId}`);

      const options = {
        socketPath: this.socketPath,
        path: `/sse?sessionId=${this.sessionId}`,
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream'
        }
      };

      this.req = http.request(options, (res) => {
        console.log(`SSE connection status: ${res.statusCode}`);

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to create SSE connection: ${res.statusCode}`));
          return;
        }

        this.res = res;

        // Set up event handling
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();

          // Process complete SSE messages
          const messages = buffer.split('\n\n');
          buffer = messages.pop(); // Keep the last incomplete message

          for (const message of messages) {
            this.processSSEMessage(message);
          }
        });

        res.on('end', () => {
          console.log('SSE connection closed');
          this.connected = false;
        });

        // Mark as connected
        this.connected = true;
        resolve();
      });

      this.req.on('error', (error) => {
        console.error('SSE connection error:', error);
        this.connected = false;
        reject(error);
      });

      this.req.end();
    });
  }

  /**
   * Process an SSE message
   */
  processSSEMessage(message) {
    const lines = message.split('\n');
    let event = 'message';
    let data = '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.substring(7);
      } else if (line.startsWith('data: ')) {
        data = line.substring(6);
      }
    }

    if (event === 'connected') {
      console.log('SSE connection established');
    } else if (event === 'message') {
      try {
        const response = JSON.parse(data);
        console.log('Received response:', response);

        if (response.id) {
          const listener = this.responseListeners.get(response.id);
          if (listener) {
            listener(response);
            this.responseListeners.delete(response.id);
          }
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    }
  }

  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        console.error('Cannot send message: Not connected to server');
        return reject(new Error('Not connected to server'));
      }

      const id = message.id || Date.now().toString();
      message.id = id;

      console.log(`Sending message with ID ${id}:`, message);

      this.responseListeners.set(id, resolve);

      // Send message via HTTP
      const options = {
        socketPath: this.socketPath,
        path: `/messages?sessionId=${this.sessionId}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk.toString();
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`Message sent successfully (ID: ${id})`);
          } else {
            console.error(`Failed to send message (ID: ${id}): ${res.statusCode}`);
            this.responseListeners.delete(id);
            reject(new Error(`HTTP error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error(`Error sending message (ID: ${id}):`, error);
        this.responseListeners.delete(id);
        reject(error);
      });

      // Write the message to the request
      req.write(JSON.stringify(message));
      req.end();

      // Set timeout to prevent hanging
      setTimeout(() => {
        if (this.responseListeners.has(id)) {
          console.error(`Request with ID ${id} timed out after 10 seconds`);
          this.responseListeners.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 10000);
    });
  }

  // High-level MCP methods
  async getServerInfo() {
    return this.sendMessage({
      type: 'getServerInfo'
    });
  }

  async listTools() {
    return this.sendMessage({
      type: 'listTools'
    });
  }

  async callTool(name, args) {
    return this.sendMessage({
      type: 'callTool',
      params: {
        name,
        arguments: args
      }
    });
  }

  disconnect() {
    if (this.res) {
      this.res.destroy();
      this.connected = false;
      console.log('Disconnected from MCP server');
    }
  }
}

// Interactive client
async function runInteractiveClient() {
  const client = new MCPSocketIOClient(SOCKET_PATH);

  try {
    await client.connect();

    // Get server info
    const serverInfo = await client.getServerInfo();
    console.log('\nServer Info:');
    console.log(`Name: ${serverInfo.serverInfo.name}`);
    console.log(`Version: ${serverInfo.serverInfo.version}`);

    // List available tools
    const toolsResponse = await client.listTools();
    console.log('\nAvailable Tools:');
    toolsResponse.tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description || 'No description'}`);
    });

    // Create interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n=== MCP Client Interactive Mode (Socket.IO) ===');
    console.log('Available commands:');
    console.log('1. echo <message> - Test the echo tool');
    console.log('2. write <path> <content> - Write content to a file');
    console.log('3. read <path> - Read content from a file');
    console.log('4. list [directory] - List files in a directory');
    console.log('5. exit - Exit the client');

    const promptUser = () => {
      rl.question('\nEnter command: ', async (input) => {
        const parts = input.trim().split(' ');
        const command = parts[0].toLowerCase();

        try {
          if (command === 'exit') {
            console.log('Goodbye!');
            client.disconnect();
            rl.close();
            process.exit(0);
          }
          else if (command === 'echo') {
            const message = parts.slice(1).join(' ');
            const result = await client.callTool('echo', { message });
            console.log('Result:', result.content[0].text);
          }
          else if (command === 'write') {
            const path = parts[1];
            const content = parts.slice(2).join(' ');
            const result = await client.callTool('writeFile', { path, content });
            console.log('Result:', result.content[0].text);
          }
          else if (command === 'read') {
            const path = parts[1];
            const result = await client.callTool('readFile', { path });
            console.log('Content:');
            console.log(result.content[0].text);
          }
          else if (command === 'list') {
            const directory = parts[1] || '';
            const result = await client.callTool('listFiles', { directory });
            console.log('Files:');
            try {
              const files = JSON.parse(result.content[0].text);
              files.forEach(file => {
                console.log(`${file.isDirectory ? 'd' : '-'} ${file.path}`);
              });
            } catch (e) {
              console.log(result.content[0].text);
            }
          }
          else {
            console.log('Unknown command. Try echo, write, read, list, or exit.');
          }
        } catch (error) {
          console.error('Error:', error.message);
        }

        promptUser();
      });
    };

    promptUser();

  } catch (error) {
    console.error('Client error:', error);
    process.exit(1);
  }
}

// If this script is run directly, start the interactive client
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runInteractiveClient();
}

// Export the client for use in other scripts
export default MCPSocketIOClient;
