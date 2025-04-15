/**
 * Augment Memory Integration
 * 
 * This module integrates the MCP Memory Server with Augment
 */

const MemoryClient = require('./memory-client');

class AugmentMemoryIntegration {
  constructor() {
    this.client = new MemoryClient();
    this.agentId = 'augment_agent';
    this.sessionId = `session_${Date.now()}`;
    this.initialized = false;
    
    // Set up event listeners
    this.client.on('connected', this.onConnected.bind(this));
    this.client.on('disconnected', this.onDisconnected.bind(this));
  }
  
  /**
   * Initialize the integration
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Register the agent
      const registerResponse = await this.client.registerAgent({
        id: this.agentId,
        name: 'Augment',
        description: 'Augment AI Assistant',
        capabilities: [
          'code_generation',
          'code_explanation',
          'debugging',
          'project_management'
        ]
      });
      
      console.log('Registered Augment agent with memory server');
      
      // Create a new session
      const sessionResponse = await this.client.storeEntity({
        id: this.sessionId,
        type: 'session',
        agentId: this.agentId,
        startTime: new Date().toISOString(),
        status: 'active'
      }, 'system');
      
      console.log('Created new session:', this.sessionId);
      
      // Create relationship between agent and session
      await this.client.createRelationship({
        sourceId: this.agentId,
        targetId: this.sessionId,
        type: 'has_session'
      });
      
      this.initialized = true;
      console.log('Memory integration initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize memory integration:', error.message);
      return false;
    }
  }
  
  /**
   * Handle connection to the memory server
   */
  async onConnected() {
    console.log('Connected to memory server, initializing...');
    await this.initialize();
  }
  
  /**
   * Handle disconnection from the memory server
   */
  onDisconnected() {
    console.log('Disconnected from memory server');
    this.initialized = false;
  }
  
  /**
   * Store a memory from the current session
   * @param {string} content - The memory content
   * @param {object} metadata - Additional metadata for the memory
   */
  async storeMemory(content, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const memoryId = `memory_${Date.now()}`;
      
      // Store the memory
      const memoryResponse = await this.client.storeEntity({
        id: memoryId,
        type: 'memory',
        content,
        sessionId: this.sessionId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString()
        }
      }, 'agent');
      
      // Create relationship between session and memory
      await this.client.createRelationship({
        sourceId: this.sessionId,
        targetId: memoryId,
        type: 'has_memory'
      });
      
      console.log('Stored memory:', memoryId);
      
      return memoryResponse.result;
    } catch (error) {
      console.error('Failed to store memory:', error.message);
      return null;
    }
  }
  
  /**
   * Retrieve memories related to a topic
   * @param {string} topic - The topic to retrieve memories for
   * @param {number} limit - The maximum number of memories to retrieve
   */
  async retrieveMemories(topic, limit = 10) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const searchResponse = await this.client.searchByText(topic, { limit });
      
      if (searchResponse.result && searchResponse.result.results) {
        return searchResponse.result.results.map(r => r.entity);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to retrieve memories:', error.message);
      return [];
    }
  }
  
  /**
   * Store user information
   * @param {object} user - The user information to store
   */
  async storeUserInfo(user) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const userId = user.id || `user_${Date.now()}`;
      
      // Store the user
      const userResponse = await this.client.storeEntity({
        ...user,
        id: userId,
        type: 'user',
        lastActive: new Date().toISOString()
      }, 'system');
      
      // Create relationship between session and user
      await this.client.createRelationship({
        sourceId: this.sessionId,
        targetId: userId,
        type: 'has_user'
      });
      
      console.log('Stored user info:', userId);
      
      return userResponse.result;
    } catch (error) {
      console.error('Failed to store user info:', error.message);
      return null;
    }
  }
  
  /**
   * Store project information
   * @param {object} project - The project information to store
   */
  async storeProjectInfo(project) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const projectId = project.id || `project_${Date.now()}`;
      
      // Store the project
      const projectResponse = await this.client.storeEntity({
        ...project,
        id: projectId,
        type: 'project',
        lastUpdated: new Date().toISOString()
      }, 'shared');
      
      // Create relationship between session and project
      await this.client.createRelationship({
        sourceId: this.sessionId,
        targetId: projectId,
        type: 'has_project'
      });
      
      console.log('Stored project info:', projectId);
      
      return projectResponse.result;
    } catch (error) {
      console.error('Failed to store project info:', error.message);
      return null;
    }
  }
  
  /**
   * Close the session and connection
   */
  async close() {
    if (!this.initialized) return;
    
    try {
      // Update session status
      await this.client.storeEntity({
        id: this.sessionId,
        type: 'session',
        agentId: this.agentId,
        endTime: new Date().toISOString(),
        status: 'completed'
      }, 'system');
      
      console.log('Closed session:', this.sessionId);
      
      // Close the connection
      this.client.close();
      this.initialized = false;
    } catch (error) {
      console.error('Failed to close session:', error.message);
    }
  }
}

module.exports = AugmentMemoryIntegration;
