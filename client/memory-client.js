/**
 * Memory Server Client
 *
 * This client connects to the MCP Memory Server via Unix socket
 * and provides methods for storing and retrieving memories.
 */

import fs from 'fs';
import path from 'path';
import net from 'net';

// Define the Unix Socket path
const MEMORY_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock';

/**
 * Memory Client class for interacting with the MCP Memory Server
 */
export default class MemoryClient {
  constructor(socketPath = MEMORY_SOCKET_PATH) {
    this.socketPath = socketPath;

    // Check if socket exists
    if (!fs.existsSync(this.socketPath)) {
      throw new Error(`Memory server socket not found at ${this.socketPath}`);
    }
  }

  /**
   * Send a request to the memory server
   */
  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      console.log(`Sending request to memory server:`, request);

      const client = net.createConnection({ path: this.socketPath }, () => {
        console.log('Connected to memory server');
        client.write(JSON.stringify(request) + '\n');
      });

      let buffer = '';
      client.on('data', (data) => {
        buffer += data.toString();

        try {
          // Try to parse the response as JSON
          const response = JSON.parse(buffer);
          console.log('Received response from memory server:', response);
          client.end();
          resolve(response);
        } catch (error) {
          // If we can't parse it yet, wait for more data
        }
      });

      client.on('end', () => {
        console.log('Disconnected from memory server');

        // If we haven't resolved yet, try to parse the buffer
        if (buffer) {
          try {
            const response = JSON.parse(buffer);
            resolve(response);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        }
      });

      client.on('error', (error) => {
        console.error('Memory server connection error:', error);
        reject(error);
      });

      // Add timeout to prevent hanging
      setTimeout(() => {
        if (!client.destroyed) {
          client.destroy();
          reject(new Error('Request timed out'));
        }
      }, 10000);
    });
  }

  /**
   * Store an entity in the memory server
   */
  async storeEntity(entity, context = 'agent') {
    const request = {
      operation: 'store_entity',
      params: {
        entity,
        context
      }
    };

    return this.sendRequest(request);
  }

  /**
   * Retrieve an entity from the memory server
   */
  async getEntity(id, context = 'agent') {
    const request = {
      operation: 'get_entity',
      params: {
        id,
        context
      }
    };

    return this.sendRequest(request);
  }

  /**
   * List entities from the memory server
   */
  async listEntities(type, context = 'agent') {
    const request = {
      operation: 'list_entities',
      params: {
        type,
        context
      }
    };

    return this.sendRequest(request);
  }

  /**
   * Store a memory for an agent
   */
  async storeMemory(agentId, content, tags = []) {
    const memory = {
      id: `memory_${Date.now()}`,
      type: 'memory',
      content,
      agentId,
      timestamp: new Date().toISOString(),
      tags
    };

    return this.storeEntity(memory);
  }

  /**
   * Register an agent with the memory server
   */
  async registerAgent(agent) {
    // Add required fields if not present
    const agentWithDefaults = {
      ...agent,
      type: agent.type || 'assistant',
      lastActive: agent.lastActive || new Date().toISOString()
    };

    return this.storeEntity(agentWithDefaults, 'system');
  }

  /**
   * Get all memories for an agent
   */
  async getAgentMemories(agentId) {
    // First list all memories
    const result = await this.listEntities('memory');

    // Then filter for the specific agent
    if (result.entities) {
      result.entities = result.entities.filter(memory => memory.agentId === agentId);
    }

    return result;
  }

  /**
   * Get all agents
   */
  async getAllAgents() {
    return this.listEntities('agent', 'system');
  }

  /**
   * Get a specific agent
   */
  async getAgent(agentId) {
    return this.getEntity(agentId, 'system');
  }
}
