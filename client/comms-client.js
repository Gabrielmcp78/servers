/**
 * Communications Client for MCP
 * 
 * This client provides functionality for sending and receiving messages
 * between agents in the MCP system.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import net from 'net';

// Define the Unix Socket path
const MCP_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';
const COMMS_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/comms-server.sock';

/**
 * Communications Client class for agent messaging
 */
export default class CommsClient {
  constructor(socketPath = MCP_SOCKET_PATH, agentId = 'athena_agent') {
    this.socketPath = socketPath;
    this.agentId = agentId;
    this.connected = false;
    this.messageListeners = new Map();
    this.sessionId = null;
    
    // Check if socket exists
    if (!fs.existsSync(this.socketPath)) {
      throw new Error(`Socket not found at ${this.socketPath}`);
    }
  }
  
  /**
   * Connect to the communications server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to communications server at socket path: ${this.socketPath}`);
      
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
          const messages = buffer.split('\\n\\n');
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
    const lines = message.split('\\n');
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
        console.log('Received message:', response);
        
        // Check if this is a message for this agent
        if (response.type === 'incomingMessage' && 
            response.message && 
            response.message.recipients && 
            response.message.recipients.includes(this.agentId)) {
          
          // Notify all message listeners
          this.notifyMessageListeners(response.message);
        }
        
        // Check if this is a response to a sent message
        if (response.id) {
          const listener = this.messageListeners.get(response.id);
          if (listener) {
            listener(response);
            this.messageListeners.delete(response.id);
          }
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    }
  }
  
  /**
   * Notify all message listeners of a new message
   */
  notifyMessageListeners(message) {
    if (this.onMessage) {
      this.onMessage(message);
    }
  }
  
  /**
   * Send a message to other agents
   */
  async sendMessage(recipients, content, metadata = {}) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        console.error('Cannot send message: Not connected to server');
        return reject(new Error('Not connected to server'));
      }
      
      const id = Date.now().toString();
      const message = {
        type: 'callTool',
        id: id,
        params: {
          name: 'sendMessage',
          arguments: {
            sender: this.agentId,
            recipients: Array.isArray(recipients) ? recipients : [recipients],
            content: content,
            timestamp: new Date().toISOString(),
            metadata: metadata
          }
        }
      };
      
      console.log(`Sending message with ID ${id}:`, message);
      
      this.messageListeners.set(id, resolve);
      
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
            this.messageListeners.delete(id);
            reject(new Error(`HTTP error: ${res.statusCode} - ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Error sending message (ID: ${id}):`, error);
        this.messageListeners.delete(id);
        reject(error);
      });
      
      // Write the message to the request
      req.write(JSON.stringify(message));
      req.end();
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        if (this.messageListeners.has(id)) {
          console.error(`Request with ID ${id} timed out after 10 seconds`);
          this.messageListeners.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 10000);
    });
  }
  
  /**
   * Get message history for this agent
   */
  async getMessageHistory() {
    return this.callTool('getMessageHistory', {
      agentId: this.agentId
    });
  }
  
  /**
   * List available agents for communication
   */
  async listAgents() {
    return this.callTool('listAgents', {});
  }
  
  /**
   * Call a tool on the MCP server
   */
  async callTool(name, args) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        console.error('Cannot call tool: Not connected to server');
        return reject(new Error('Not connected to server'));
      }
      
      const id = Date.now().toString();
      const message = {
        type: 'callTool',
        id: id,
        params: {
          name: name,
          arguments: args
        }
      };
      
      console.log(`Calling tool ${name} with ID ${id}:`, message);
      
      this.messageListeners.set(id, resolve);
      
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
            console.log(`Tool call sent successfully (ID: ${id})`);
          } else {
            console.error(`Failed to call tool (ID: ${id}): ${res.statusCode}`);
            this.messageListeners.delete(id);
            reject(new Error(`HTTP error: ${res.statusCode} - ${data}`));
          }
        });
      });
      
      req.on('error', (error) => {
        console.error(`Error calling tool (ID: ${id}):`, error);
        this.messageListeners.delete(id);
        reject(error);
      });
      
      // Write the message to the request
      req.write(JSON.stringify(message));
      req.end();
      
      // Set timeout to prevent hanging
      setTimeout(() => {
        if (this.messageListeners.has(id)) {
          console.error(`Request with ID ${id} timed out after 10 seconds`);
          this.messageListeners.delete(id);
          reject(new Error('Request timed out'));
        }
      }, 10000);
    });
  }
  
  /**
   * Set a callback for incoming messages
   */
  setMessageCallback(callback) {
    this.onMessage = callback;
  }
  
  /**
   * Disconnect from the communications server
   */
  disconnect() {
    if (this.res) {
      this.res.destroy();
      this.connected = false;
      console.log('Disconnected from communications server');
    }
  }
}
