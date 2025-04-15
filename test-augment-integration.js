/**
 * Test Augment Memory Integration
 * 
 * This script tests the integration between Augment and the MCP Memory Server
 */

const AugmentMemoryIntegration = require('./augment-memory-integration');

async function runTest() {
  console.log('Starting Augment Memory Integration test...');
  
  // Create the integration
  const integration = new AugmentMemoryIntegration();
  
  try {
    // Initialize the integration
    await integration.initialize();
    
    // Store user information
    const user = await integration.storeUserInfo({
      name: 'Gabriel',
      email: 'gabriel@example.com',
      preferences: {
        theme: 'dark',
        language: 'javascript'
      }
    });
    
    console.log('Stored user information:', user);
    
    // Store project information
    const project = await integration.storeProjectInfo({
      name: 'MCP Memory Server',
      description: 'A memory server for MCP',
      repository: 'https://github.com/user/mcp-memory-server',
      language: 'javascript',
      tags: ['memory', 'server', 'mcp']
    });
    
    console.log('Stored project information:', project);
    
    // Store some memories
    await integration.storeMemory('User prefers to use JavaScript for backend development', {
      category: 'user_preference',
      confidence: 0.9
    });
    
    await integration.storeMemory('Project uses Node.js and Express for the server', {
      category: 'project_info',
      confidence: 0.95
    });
    
    await integration.storeMemory('User wants to implement a memory system for AI agents', {
      category: 'user_goal',
      confidence: 0.8
    });
    
    // Retrieve memories related to a topic
    const memories = await integration.retrieveMemories('memory system');
    console.log('Retrieved memories:', memories);
    
    // Close the session
    await integration.close();
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the test
runTest();
