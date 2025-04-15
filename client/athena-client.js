/**
 * Athena Client
 * 
 * A unified client that combines MCP, Memory, and Communications functionality
 * for the Athena agent.
 */

import MCPClient from './mcp-socketio-client.js';
import MemoryClient from './memory-client.js';
import CommsClient from './comms-client.js';
import fs from 'fs';
import path from 'path';

// Define the socket paths
const MCP_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';
const MEMORY_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock';

// Define Athena's agent ID
const ATHENA_AGENT_ID = 'athena_agent';

/**
 * Athena Client class
 */
export default class AthenaClient {
  constructor() {
    // Check if sockets exist
    if (!fs.existsSync(MCP_SOCKET_PATH)) {
      throw new Error(`MCP socket not found at ${MCP_SOCKET_PATH}`);
    }
    
    if (!fs.existsSync(MEMORY_SOCKET_PATH)) {
      throw new Error(`Memory socket not found at ${MEMORY_SOCKET_PATH}`);
    }
    
    // Create clients
    this.mcpClient = new MCPClient(MCP_SOCKET_PATH);
    this.memoryClient = new MemoryClient(MEMORY_SOCKET_PATH);
    this.commsClient = new CommsClient(MCP_SOCKET_PATH, ATHENA_AGENT_ID);
    
    // Initialize state
    this.connected = false;
    this.messageHandlers = [];
  }
  
  /**
   * Connect to all services
   */
  async connect() {
    console.log('Connecting to MCP, Memory, and Communications services...');
    
    // Connect to MCP server
    await this.mcpClient.connect();
    console.log('Connected to MCP server');
    
    // Connect to communications server
    await this.commsClient.connect();
    console.log('Connected to communications server');
    
    // Set up message callback
    this.commsClient.setMessageCallback((message) => {
      this.handleIncomingMessage(message);
    });
    
    this.connected = true;
    console.log('Athena client connected to all services');
    
    return true;
  }
  
  /**
   * Handle incoming messages
   */
  async handleIncomingMessage(message) {
    console.log('\n=== Incoming Message ===');
    console.log(`From: ${message.sender}`);
    console.log(`Content: ${message.content}`);
    console.log(`Timestamp: ${message.timestamp}`);
    console.log('=========================\n');
    
    // Store the message in memory
    await this.storeMessageInMemory(message);
    
    // Notify all message handlers
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }
  
  /**
   * Store a message in memory
   */
  async storeMessageInMemory(message) {
    try {
      const memoryEntity = {
        id: `message_${Date.now()}`,
        type: 'message',
        content: message.content,
        agentId: ATHENA_AGENT_ID,
        sender: message.sender,
        recipients: message.recipients,
        timestamp: message.timestamp || new Date().toISOString(),
        tags: ['message', message.sender]
      };
      
      const result = await this.memoryClient.storeEntity(memoryEntity);
      console.log('Message stored in memory:', result.result.id);
      return result.result;
    } catch (error) {
      console.error('Failed to store message in memory:', error);
      throw error;
    }
  }
  
  /**
   * Send a message to another agent
   */
  async sendMessage(recipient, content, metadata = {}) {
    if (!this.connected) {
      throw new Error('Not connected to services');
    }
    
    try {
      // Send the message
      const response = await this.commsClient.sendMessage(recipient, content, metadata);
      
      // Store the sent message in memory
      const sentMessage = {
        sender: ATHENA_AGENT_ID,
        recipients: Array.isArray(recipient) ? recipient : [recipient],
        content: content,
        timestamp: new Date().toISOString(),
        metadata: metadata
      };
      
      await this.storeMessageInMemory(sentMessage);
      
      return response;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }
  
  /**
   * Get message history
   */
  async getMessageHistory() {
    if (!this.connected) {
      throw new Error('Not connected to services');
    }
    
    try {
      // Try to get message history from the communications server
      try {
        const historyResponse = await this.commsClient.getMessageHistory();
        if (historyResponse && historyResponse.content) {
          return JSON.parse(historyResponse.content[0].text);
        }
      } catch (error) {
        console.log('Failed to get message history from comms server, falling back to memory');
      }
      
      // Fall back to getting messages from memory
      const query = {
        type: 'message',
        agentId: ATHENA_AGENT_ID
      };
      
      const result = await this.memoryClient.listEntities('message');
      
      if (result.result && result.result.entities) {
        // Filter for messages related to this agent
        const messages = result.result.entities.filter(entity => 
          entity.agentId === ATHENA_AGENT_ID || 
          (entity.recipients && entity.recipients.includes(ATHENA_AGENT_ID))
        );
        
        // Sort by timestamp
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        return messages;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get message history:', error);
      throw error;
    }
  }
  
  /**
   * List available agents
   */
  async listAgents() {
    if (!this.connected) {
      throw new Error('Not connected to services');
    }
    
    try {
      // Try to get agents from the communications server
      try {
        const agentsResponse = await this.commsClient.listAgents();
        if (agentsResponse && agentsResponse.content) {
          return JSON.parse(agentsResponse.content[0].text);
        }
      } catch (error) {
        console.log('Failed to list agents from comms server, falling back to memory');
      }
      
      // Fall back to getting agents from memory
      const result = await this.memoryClient.listEntities('agent', 'system');
      
      if (result.result && result.result.entities) {
        return result.result.entities;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to list agents:', error);
      throw error;
    }
  }
  
  /**
   * Store a memory
   */
  async storeMemory(content, tags = []) {
    if (!this.connected) {
      throw new Error('Not connected to services');
    }
    
    try {
      return await this.memoryClient.storeMemory(ATHENA_AGENT_ID, content, tags);
    } catch (error) {
      console.error('Failed to store memory:', error);
      throw error;
    }
  }
  
  /**
   * Get all memories
   */
  async getMemories() {
    if (!this.connected) {
      throw new Error('Not connected to services');
    }
    
    try {
      const result = await this.memoryClient.getAgentMemories(ATHENA_AGENT_ID);
      
      if (result.result && result.result.entities) {
        return result.result.entities;
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get memories:', error);
      throw error;
    }
  }
  
  /**
   * Call an MCP tool
   */
  async callTool(name, args) {
    if (!this.connected) {
      throw new Error('Not connected to services');
    }
    
    try {
      return await this.mcpClient.callTool(name, args);
    } catch (error) {
      console.error(`Failed to call tool ${name}:`, error);
      throw error;
    }
  }
  
  /**
   * Add a message handler
   */
  addMessageHandler(handler) {
    this.messageHandlers.push(handler);
  }
  
  /**
   * Disconnect from all services
   */
  disconnect() {
    this.mcpClient.disconnect();
    this.commsClient.disconnect();
    this.connected = false;
    console.log('Disconnected from all services');
  }
}
