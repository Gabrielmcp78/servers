/**
 * MCP Memory Client for Augment
 * 
 * A client library for connecting Augment to the MCP Memory Server
 */

const net = require('net');
const EventEmitter = require('events');

class MemoryClient extends EventEmitter {
  /**
   * Create a new Memory Client
   * @param {string} socketPath - Path to the memory server socket
   */
  constructor(socketPath = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock') {
    super();
    this.socketPath = socketPath;
    this.connected = false;
    this.requestQueue = [];
    this.pendingRequests = new Map();
    this.requestId = 1;
    this.buffer = '';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Connect to the server
    this.connect();
  }
  
  /**
   * Connect to the memory server
   */
  connect() {
    try {
      this.socket = net.createConnection({ path: this.socketPath }, () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        console.log('Connected to memory server');
        
        // Process any queued requests
        this.processQueue();
      });
      
      this.setupListeners();
    } catch (error) {
      console.error('Failed to connect to memory server:', error.message);
      this.handleDisconnect();
    }
  }
  
  /**
   * Set up event listeners for the socket
   */
  setupListeners() {
    this.socket.on('data', (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });
    
    this.socket.on('end', () => {
      console.log('Disconnected from memory server');
      this.handleDisconnect();
    });
    
    this.socket.on('error', (error) => {
      console.error('Memory server connection error:', error.message);
      this.handleDisconnect();
    });
  }
  
  /**
   * Handle disconnection from the server
   */
  handleDisconnect() {
    this.connected = false;
    this.emit('disconnected');
    
    // Attempt to reconnect
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Failed to reconnect to memory server after multiple attempts');
      this.emit('reconnect_failed');
    }
  }
  
  /**
   * Process the buffer for complete JSON messages
   */
  processBuffer() {
    try {
      // Try to parse complete JSON messages
      const response = JSON.parse(this.buffer);
      this.buffer = '';
      
      // Handle the response
      this.handleResponse(response);
    } catch (error) {
      // Incomplete JSON, wait for more data
    }
  }
  
  /**
   * Handle a response from the server
   * @param {object} response - The response from the server
   */
  handleResponse(response) {
    const requestId = response.requestId;
    
    if (requestId && this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId);
      
      if (response.error) {
        reject(new Error(response.message || 'Unknown error'));
      } else {
        resolve(response);
      }
      
      this.pendingRequests.delete(requestId);
    } else {
      // Handle unsolicited responses
      this.emit('response', response);
    }
  }
  
  /**
   * Process the request queue
   */
  processQueue() {
    if (!this.connected) return;
    
    while (this.requestQueue.length > 0) {
      const { request, resolve, reject } = this.requestQueue.shift();
      this.sendToServer(request, resolve, reject);
    }
  }
  
  /**
   * Send a request to the server
   * @param {object} request - The request to send
   * @returns {Promise} - A promise that resolves with the response
   */
  sendRequest(request) {
    return new Promise((resolve, reject) => {
      // Add a request ID
      request.requestId = this.requestId++;
      
      if (this.connected) {
        this.sendToServer(request, resolve, reject);
      } else {
        // Queue the request for when we connect
        this.requestQueue.push({ request, resolve, reject });
      }
    });
  }
  
  /**
   * Send a request to the server
   * @param {object} request - The request to send
   * @param {function} resolve - The resolve function for the promise
   * @param {function} reject - The reject function for the promise
   */
  sendToServer(request, resolve, reject) {
    try {
      // Store the promise callbacks
      this.pendingRequests.set(request.requestId, { resolve, reject });
      
      // Send the request
      this.socket.write(JSON.stringify(request) + '\n');
    } catch (error) {
      reject(error);
      this.pendingRequests.delete(request.requestId);
    }
  }
  
  /**
   * Register an agent with the memory server
   * @param {object} agent - The agent to register
   * @returns {Promise} - A promise that resolves with the registered agent
   */
  async registerAgent(agent) {
    return this.sendRequest({
      operation: 'store_entity',
      params: {
        entity: {
          ...agent,
          type: 'agent',
          lastActive: new Date().toISOString()
        },
        context: 'system'
      }
    });
  }
  
  /**
   * Store an entity in the memory server
   * @param {object} entity - The entity to store
   * @param {string} context - The context to store the entity in
   * @returns {Promise} - A promise that resolves with the stored entity
   */
  async storeEntity(entity, context = 'shared') {
    return this.sendRequest({
      operation: 'store_entity',
      params: {
        entity,
        context
      }
    });
  }
  
  /**
   * Get an entity from the memory server
   * @param {string} id - The ID of the entity to get
   * @returns {Promise} - A promise that resolves with the entity
   */
  async getEntity(id) {
    return this.sendRequest({
      operation: 'get_entity',
      params: {
        id
      }
    });
  }
  
  /**
   * Create a relationship between two entities
   * @param {object} relationship - The relationship to create
   * @returns {Promise} - A promise that resolves with the created relationship
   */
  async createRelationship(relationship) {
    return this.sendRequest({
      operation: 'create_relationship',
      params: {
        relationship
      }
    });
  }
  
  /**
   * Traverse the graph starting from an entity
   * @param {string} startEntityId - The ID of the entity to start from
   * @param {number} maxDepth - The maximum depth to traverse
   * @param {string} direction - The direction to traverse (outgoing, incoming, both)
   * @returns {Promise} - A promise that resolves with the traversal results
   */
  async traverseGraph(startEntityId, maxDepth = 2, direction = 'both') {
    return this.sendRequest({
      operation: 'traverse_graph',
      params: {
        startEntityId,
        maxDepth,
        direction
      }
    });
  }
  
  /**
   * Search for entities by text
   * @param {string} query - The text to search for
   * @param {object} options - Search options
   * @returns {Promise} - A promise that resolves with the search results
   */
  async searchByText(query, options = { limit: 10 }) {
    return this.sendRequest({
      operation: 'search_by_text',
      params: {
        query,
        options
      }
    });
  }
  
  /**
   * Store a memory for the current session
   * @param {string} content - The memory content
   * @param {object} metadata - Additional metadata for the memory
   * @returns {Promise} - A promise that resolves with the stored memory
   */
  async storeMemory(content, metadata = {}) {
    const memory = {
      type: 'memory',
      content,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: 'augment'
      }
    };
    
    return this.storeEntity(memory, 'agent');
  }
  
  /**
   * Close the connection to the memory server
   */
  close() {
    if (this.socket) {
      this.socket.end();
    }
  }
}

module.exports = MemoryClient;
