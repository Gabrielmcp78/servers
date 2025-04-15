// MCP Unix Socket Client
// This client connects to the MCP server via Unix domain socket

import http from 'http';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import readline from 'readline';

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

// Custom Unix Socket Transport
class UnixSocketClient extends EventEmitter {
  constructor(socketPath) {
    super();
    this.socketPath = socketPath;
    this.sessionId = Math.random().toString(36).substring(2, 15);
    this.connected = false;
    this.messageQueue = [];
    this.responseListeners = new Map();
  }
  
  async connect() {
    try {
      // Connect to the SSE endpoint
      this.connectEventSource();
      
      // Test connection with health check
      const health = await this.makeRequest('GET', '/health');
      console.log('Connected to MCP server. Health check:', health);
      this.connected = true;
      
      // Process any queued messages
      while (this.messageQueue.length > 0) {
        const [message, resolve, reject] = this.messageQueue.shift();
        this.sendMessageInternal(message).then(resolve).catch(reject);
      }
      
      return health;
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }
  
  connectEventSource() {
    const options = {
      socketPath: this.socketPath,
      path: `/sse?sessionId=${this.sessionId}`,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    };
    
    const req = http.request(options, (res) => {
      console.log(`SSE Response status: ${res.statusCode}`);
      
      let buffer = '';
      
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        
        // Process complete events
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        
        for (const event of events) {
          if (event.trim() === '') continue;
          
          // Extract event type and data
          const eventLines = event.split('\n');
          let eventType = '';
          let eventData = '';
          
          for (const line of eventLines) {
            if (line.startsWith('event:')) {
              eventType = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              eventData = line.substring(5).trim();
            }
          }
          
          if (eventType && eventData) {
            try {
              const parsedData = JSON.parse(eventData);
              
              if (eventType === 'message' && parsedData.id) {
                const listener = this.responseListeners.get(parsedData.id);
                if (listener) {
                  listener(parsedData);
                  this.responseListeners.delete(parsedData.id);
                }
              }
              
              this.emit(eventType, parsedData);
            } catch (error) {
              console.error('Error parsing event data:', error);
            }
          }
        }
      });
      
      res.on('end', () => {
        console.log('SSE connection closed');
        this.connected = false;
        
        // Try to reconnect after a short delay
        setTimeout(() => this.connectEventSource(), 1000);
      });
      
      res.on('error', (error) => {
        console.error('SSE connection error:', error);
        this.connected = false;
        
        // Try to reconnect after a short delay
        setTimeout(() => this.connectEventSource(), 1000);
      });
    });
    
    req.on('error', (error) => {
      console.error('SSE request error:', error);
      this.connected = false;
      
      // Try to reconnect after a short delay
      setTimeout(() => this.connectEventSource(), 1000);
    });
    
    req.end();
  }
  
  async sendMessage(message) {
    if (!this.connected) {
      return new Promise((resolve, reject) => {
        this.messageQueue.push([message, resolve, reject]);
      });
    }
    
    return this.sendMessageInternal(message);
  }
  
  async sendMessageInternal(message) {
    return new Promise((resolve, reject) => {
      const id = message.id || Math.random().toString(36).substring(2, 15);
      message.id = id;
      
      this.responseListeners.set(id, resolve);
      
      this.makeRequest('POST', `/messages?sessionId=${this.sessionId}`, message)
        .catch(error => {
          this.responseListeners.delete(id);
          reject(error);
        });
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        if (this.responseListeners.has(id)) {
          this.responseListeners.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 10000);
    });
  }
  
  async makeRequest(method, path, body) {
    return new Promise((resolve, reject) => {
      const options = {
        socketPath: this.socketPath,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(data ? JSON.parse(data) : null);
            } catch (error) {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      
      req.end();
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
}

// Interactive client
async function runInteractiveClient() {
  const client = new UnixSocketClient(SOCKET_PATH);
  
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
    
    console.log('\n=== MCP Client Interactive Mode ===');
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

// Start the interactive client
runInteractiveClient();
