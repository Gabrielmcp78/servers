/**
 * Augment Startup Script
 * 
 * This script is executed when Augment starts up.
 * It initializes all required components and extensions.
 */

console.log('Initializing Augment...');

// Import the memory client
const MemoryClient = require('../extensions/memory-client/memory-client');

// Create a global memory client instance
const memoryClient = new MemoryClient();

// Set up event listeners
memoryClient.on('connected', async () => {
  console.log('Connected to memory server');
  
  try {
    // Register Augment as an agent
    const registerResponse = await memoryClient.registerAgent({
      id: 'augment_agent',
      name: 'Augment',
      description: 'Augment AI Assistant',
      capabilities: [
        'code_generation',
        'code_explanation',
        'debugging',
        'project_management'
      ]
    });
    
    console.log('Registered Augment with memory server');
    
    // Create a new session
    const sessionId = `session_${Date.now()}`;
    const sessionResponse = await memoryClient.storeEntity({
      id: sessionId,
      type: 'session',
      agentId: 'augment_agent',
      startTime: new Date().toISOString(),
      status: 'active'
    }, 'system');
    
    console.log('Created new session:', sessionId);
    
    // Store the session ID for later use
    global.augmentSessionId = sessionId;
    
    // Create relationship between agent and session
    await memoryClient.createRelationship({
      sourceId: 'augment_agent',
      targetId: sessionId,
      type: 'has_session'
    });
  } catch (error) {
    console.error('Failed to initialize memory integration:', error);
  }
});

memoryClient.on('disconnected', () => {
  console.log('Disconnected from memory server');
});

memoryClient.on('error', (error) => {
  console.error('Memory server connection error:', error);
});

// Define global memory functions
global.storeMemory = async (content, metadata = {}) => {
  try {
    const memoryId = `memory_${Date.now()}`;
    
    // Store the memory
    const memoryResponse = await memoryClient.storeEntity({
      id: memoryId,
      type: 'memory',
      content,
      sessionId: global.augmentSessionId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: 'augment'
      }
    }, 'agent');
    
    // Create relationship between session and memory
    if (global.augmentSessionId) {
      await memoryClient.createRelationship({
        sourceId: global.augmentSessionId,
        targetId: memoryId,
        type: 'has_memory'
      });
    }
    
    return memoryResponse.result;
  } catch (error) {
    console.error('Failed to store memory:', error);
    return null;
  }
};

global.retrieveMemories = async (query, limit = 10) => {
  try {
    const searchResponse = await memoryClient.searchByText(query, { limit });
    
    if (searchResponse.result && searchResponse.result.results) {
      return searchResponse.result.results.map(r => r.entity);
    }
    
    return [];
  } catch (error) {
    console.error('Failed to retrieve memories:', error);
    return [];
  }
};

global.storeUserInfo = async (user) => {
  try {
    const userId = user.id || `user_${Date.now()}`;
    
    // Store the user
    const userResponse = await memoryClient.storeEntity({
      ...user,
      id: userId,
      type: 'user',
      lastActive: new Date().toISOString()
    }, 'system');
    
    // Create relationship between session and user
    if (global.augmentSessionId) {
      await memoryClient.createRelationship({
        sourceId: global.augmentSessionId,
        targetId: userId,
        type: 'has_user'
      });
    }
    
    return userResponse.result;
  } catch (error) {
    console.error('Failed to store user info:', error);
    return null;
  }
};

global.storeProjectInfo = async (project) => {
  try {
    const projectId = project.id || `project_${Date.now()}`;
    
    // Store the project
    const projectResponse = await memoryClient.storeEntity({
      ...project,
      id: projectId,
      type: 'project',
      lastUpdated: new Date().toISOString()
    }, 'shared');
    
    // Create relationship between session and project
    if (global.augmentSessionId) {
      await memoryClient.createRelationship({
        sourceId: global.augmentSessionId,
        targetId: projectId,
        type: 'has_project'
      });
    }
    
    return projectResponse.result;
  } catch (error) {
    console.error('Failed to store project info:', error);
    return null;
  }
};

// Handle application shutdown
process.on('exit', async () => {
  if (global.augmentSessionId) {
    try {
      // Update session status
      await memoryClient.storeEntity({
        id: global.augmentSessionId,
        type: 'session',
        agentId: 'augment_agent',
        endTime: new Date().toISOString(),
        status: 'completed'
      }, 'system');
      
      console.log('Closed session:', global.augmentSessionId);
    } catch (error) {
      console.error('Failed to close session:', error);
    }
  }
  
  // Close the connection
  memoryClient.close();
});

// Export the memory client for use in other modules
module.exports = {
  memoryClient
};

console.log('Augment initialization complete');
