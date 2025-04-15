/**
 * Universal MCP Client
 *
 * A comprehensive client that provides access to all MCP functions:
 * - Memory operations
 * - Communications
 * - MCP tools
 */

const net = require('net');
const fs = require('fs');
const readline = require('readline');
const http = require('http');

// Configuration
const MEMORY_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock';
const MCP_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';

// Default agent details (Athena)
const DEFAULT_AGENT = {
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

// Check if MCP socket exists
if (!fs.existsSync(MCP_SOCKET_PATH)) {
  console.error(`MCP server socket not found at ${MCP_SOCKET_PATH}`);
  process.exit(1);
}

// Check if memory socket exists (but don't exit if not found)
if (!fs.existsSync(MEMORY_SOCKET_PATH)) {
  console.warn(`Memory server socket not found at ${MEMORY_SOCKET_PATH}`);
  console.warn('Memory-related functions will not work');
}

/**
 * Universal MCP Client class
 */
class UniversalClient {
  constructor(agentId = DEFAULT_AGENT.id, agentDetails = DEFAULT_AGENT) {
    this.agentId = agentId;
    this.agentDetails = agentDetails;
    this.connected = false;
    this.sessionId = null;
    this.sseConnection = null;
    this.messageListeners = [];
  }

  /**
   * Connect to the MCP server via SSE
   */
  async connectSSE() {
    return new Promise((resolve, reject) => {
      console.log('Connecting to MCP server via SSE...');

      this.sessionId = Math.random().toString(36).substring(2, 15);
      console.log(`Session ID: ${this.sessionId}`);

      const options = {
        socketPath: MCP_SOCKET_PATH,
        path: `/sse?sessionId=${this.sessionId}`,
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream'
        }
      };

      const req = http.request(options, (res) => {
        console.log(`SSE connection status: ${res.statusCode}`);

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to create SSE connection: ${res.statusCode}`));
          return;
        }

        this.sseConnection = res;

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

      req.on('error', (error) => {
        console.error('SSE connection error:', error);
        this.connected = false;
        reject(error);
      });

      req.end();
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
        console.log('Received SSE message:', response);

        // Check if this is a message for this agent
        if (response.type === 'incomingMessage' &&
            response.message &&
            response.message.recipients &&
            response.message.recipients.includes(this.agentId)) {

          console.log('\n=== Incoming Message ===');
          console.log(`From: ${response.message.sender}`);
          console.log(`Content: ${response.message.content}`);
          console.log(`Timestamp: ${response.message.timestamp}`);
          console.log('=========================\n');

          // Store the message in memory
          this.storeMemory(`Message from ${response.message.sender}: ${response.message.content}`,
                          ['message', 'received', response.message.sender]);

          // Notify all message listeners
          for (const listener of this.messageListeners) {
            listener(response.message);
          }
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    }
  }

  /**
   * Send a request to the memory server
   */
  async sendMemoryRequest(request) {
    // Check if memory server is available
    if (!fs.existsSync(MEMORY_SOCKET_PATH)) {
      throw new Error('Memory server not available');
    }

    return new Promise((resolve, reject) => {
      const client = net.createConnection({ path: MEMORY_SOCKET_PATH }, () => {
        console.log('Connected to memory server');
        client.write(JSON.stringify(request) + '\n');
      });

      let data = '';
      client.on('data', (chunk) => {
        data += chunk.toString();
      });

      client.on('end', () => {
        console.log('Disconnected from memory server');
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });

      client.on('error', (error) => {
        console.error('Memory server connection error:', error);
        reject(error);
      });

      // Add timeout
      setTimeout(() => {
        if (!client.destroyed) {
          client.destroy();
          reject(new Error('Request timed out'));
        }
      }, 5000);
    });
  }

  /**
   * Send a message to the MCP server
   */
  async sendMcpMessage(message) {
    if (!this.connected || !this.sessionId) {
      throw new Error('Not connected to MCP server. Call connectSSE() first.');
    }

    return new Promise((resolve, reject) => {
      const options = {
        socketPath: MCP_SOCKET_PATH,
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
            console.log('Message sent successfully');
            try {
              const response = JSON.parse(data);
              resolve(response);
            } catch (error) {
              resolve({ status: 'ok', data });
            }
          } else {
            console.error(`Failed to send message: ${res.statusCode}`);
            reject(new Error(`HTTP error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error('Error sending message:', error);
        reject(error);
      });

      // Write the message to the request
      req.write(JSON.stringify(message));
      req.end();
    });
  }

  /**
   * Register the agent with the memory server
   */
  async registerAgent() {
    console.log(`Registering agent ${this.agentId} with memory server...`);

    const request = {
      operation: 'store_entity',
      params: {
        entity: {
          ...this.agentDetails,
          lastActive: new Date().toISOString()
        },
        context: 'system'
      }
    };

    try {
      const response = await this.sendMemoryRequest(request);
      console.log('Registration successful:', response.result.id);
      return response.result;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Store a memory
   */
  async storeMemory(content, tags = []) {
    console.log(`Storing memory: ${content}`);

    const request = {
      operation: 'store_entity',
      params: {
        entity: {
          id: `memory_${Date.now()}`,
          type: 'memory',
          content,
          agentId: this.agentId,
          timestamp: new Date().toISOString(),
          tags
        },
        context: 'agent'
      }
    };

    try {
      const response = await this.sendMemoryRequest(request);
      console.log('Memory stored successfully:', response.result.id);
      return response.result;
    } catch (error) {
      console.error('Failed to store memory:', error);
      throw error;
    }
  }

  /**
   * List memories
   */
  async listMemories() {
    console.log('Listing memories...');

    const request = {
      operation: 'list_entities',
      params: {
        type: 'memory',
        context: 'agent'
      }
    };

    try {
      const response = await this.sendMemoryRequest(request);

      if (response.result && response.result.entities) {
        // Filter for agent's memories
        const memories = response.result.entities.filter(
          memory => memory.agentId === this.agentId
        );

        console.log(`Found ${memories.length} memories:`);
        memories.forEach((memory, index) => {
          console.log(`${index + 1}. ${memory.content}`);
          console.log(`   Tags: ${memory.tags ? memory.tags.join(', ') : 'none'}`);
          console.log(`   Time: ${memory.timestamp}`);
          console.log('---');
        });

        return memories;
      } else {
        console.log('No memories found');
        return [];
      }
    } catch (error) {
      console.error('Failed to list memories:', error);
      throw error;
    }
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(recipient, content) {
    if (!this.connected) {
      throw new Error('Not connected to MCP server. Call connectSSE() first.');
    }

    console.log(`Sending message to ${recipient}: ${content}`);

    const message = {
      type: 'callTool',
      id: Date.now().toString(),
      params: {
        name: 'sendMessage',
        arguments: {
          sender: this.agentId,
          recipients: Array.isArray(recipient) ? recipient : [recipient],
          content,
          timestamp: new Date().toISOString()
        }
      }
    };

    try {
      const response = await this.sendMcpMessage(message);
      console.log('Message sent successfully:', response);

      // Store the message in memory
      await this.storeMemory(`Message to ${recipient}: ${content}`, ['message', 'sent', recipient]);

      return response;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(name, args) {
    if (!this.connected) {
      throw new Error('Not connected to MCP server. Call connectSSE() first.');
    }

    console.log(`Calling tool ${name} with args:`, args);

    const message = {
      type: 'callTool',
      id: Date.now().toString(),
      params: {
        name,
        arguments: args
      }
    };

    try {
      const response = await this.sendMcpMessage(message);
      console.log(`Tool ${name} called successfully:`, response);
      return response;
    } catch (error) {
      console.error(`Failed to call tool ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get server info
   */
  async getServerInfo() {
    if (!this.connected) {
      throw new Error('Not connected to MCP server. Call connectSSE() first.');
    }

    console.log('Getting server info...');

    const message = {
      type: 'getServerInfo',
      id: Date.now().toString()
    };

    try {
      const response = await this.sendMcpMessage(message);
      console.log('Server info:', response);
      return response;
    } catch (error) {
      console.error('Failed to get server info:', error);
      throw error;
    }
  }

  /**
   * List available tools
   */
  async listTools() {
    if (!this.connected) {
      throw new Error('Not connected to MCP server. Call connectSSE() first.');
    }

    console.log('Listing available tools...');

    const message = {
      type: 'listTools',
      id: Date.now().toString()
    };

    try {
      const response = await this.sendMcpMessage(message);
      console.log('Available tools:', response);
      return response;
    } catch (error) {
      console.error('Failed to list tools:', error);
      throw error;
    }
  }

  /**
   * Add a message listener
   */
  addMessageListener(listener) {
    this.messageListeners.push(listener);
  }

  /**
   * Disconnect from the MCP server
   */
  disconnect() {
    if (this.sseConnection) {
      this.sseConnection.destroy();
      this.connected = false;
      console.log('Disconnected from MCP server');
    }
  }
}

/**
 * Run the interactive client
 */
async function runInteractiveClient() {
  try {
    // Create client
    const client = new UniversalClient();

    // Try to register agent if memory server is available
    if (fs.existsSync(MEMORY_SOCKET_PATH)) {
      try {
        await client.registerAgent();
        console.log('Agent registered successfully');
      } catch (error) {
        console.warn('Failed to register agent with memory server:', error.message);
        console.warn('Memory-related functions will not work');
      }
    }

    // Connect to MCP server
    await client.connectSSE();

    // Create interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n=== Universal MCP Client ===');
    console.log('Available commands:');
    console.log('1. send <recipient> <message> - Send a message to another agent');
    console.log('2. memory <content> - Store a new memory');
    console.log('3. memories - List all memories');
    console.log('4. echo <message> - Test the echo tool');
    console.log('5. write <path> <content> - Write content to a file');
    console.log('6. read <path> - Read content from a file');
    console.log('7. list [directory] - List files in a directory');
    console.log('8. tools - List available tools');
    console.log('9. info - Get server info');
    console.log('10. exit - Exit the client');

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
          else if (command === 'send') {
            if (parts.length < 3) {
              console.log('Invalid format. Use: send <recipient> <message>');
            } else {
              const recipient = parts[1];
              const message = parts.slice(2).join(' ');
              await client.sendMessage(recipient, message);
            }
          }
          else if (command === 'memory') {
            if (parts.length < 2) {
              console.log('Invalid format. Use: memory <content>');
            } else {
              const content = parts.slice(1).join(' ');
              await client.storeMemory(content, ['user_input']);
            }
          }
          else if (command === 'memories') {
            await client.listMemories();
          }
          else if (command === 'echo') {
            if (parts.length < 2) {
              console.log('Invalid format. Use: echo <message>');
            } else {
              const message = parts.slice(1).join(' ');
              const result = await client.callTool('echo', { message });
              if (result && result.content && result.content[0]) {
                console.log('Echo result:', result.content[0].text);
              } else {
                console.log('Echo result:', result);
              }
            }
          }
          else if (command === 'write') {
            if (parts.length < 3) {
              console.log('Invalid format. Use: write <path> <content>');
            } else {
              const path = parts[1];
              const content = parts.slice(2).join(' ');
              const result = await client.callTool('writeFile', { path, content });
              if (result && result.content && result.content[0]) {
                console.log('Write result:', result.content[0].text);
              } else {
                console.log('Write result:', result);
              }
            }
          }
          else if (command === 'read') {
            if (parts.length < 2) {
              console.log('Invalid format. Use: read <path>');
            } else {
              const path = parts[1];
              const result = await client.callTool('readFile', { path });
              if (result && result.content && result.content[0]) {
                console.log('Content:');
                console.log(result.content[0].text);
              } else {
                console.log('Read result:', result);
              }
            }
          }
          else if (command === 'list') {
            const directory = parts[1] || '';
            const result = await client.callTool('listFiles', { directory });
            if (result && result.content && result.content[0]) {
              console.log('Files:');
              try {
                const files = JSON.parse(result.content[0].text);
                files.forEach(file => {
                  console.log(`${file.isDirectory ? 'd' : '-'} ${file.path}`);
                });
              } catch (e) {
                console.log(result.content[0].text);
              }
            } else {
              console.log('List result:', result);
            }
          }
          else if (command === 'tools') {
            const tools = await client.listTools();
            if (tools && tools.tools) {
              console.log('Available tools:');
              tools.tools.forEach(tool => {
                console.log(`- ${tool.name}: ${tool.description || 'No description'}`);
              });
            } else {
              console.log('Tools result:', tools);
            }
          }
          else if (command === 'info') {
            const info = await client.getServerInfo();
            if (info && info.serverInfo) {
              console.log('Server info:');
              console.log(`Name: ${info.serverInfo.name}`);
              console.log(`Version: ${info.serverInfo.version}`);
            } else {
              console.log('Server info:', info);
            }
          }
          else {
            console.log('Unknown command. Try send, memory, memories, echo, write, read, list, tools, info, or exit.');
          }
        } catch (error) {
          console.error('Error:', error.message);
        }

        promptUser();
      });
    };

    promptUser();

  } catch (error) {
    console.error('Error during startup:', error);
    process.exit(1);
  }
}

// Run the interactive client
runInteractiveClient();
