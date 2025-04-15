/**
 * Simple Memory Client Test
 */

const MemoryClient = require('./memory-client');

async function runTest() {
  console.log('Starting simple memory client test...');
  
  // Create the client
  const client = new MemoryClient();
  
  // Set up event listeners
  client.on('connected', async () => {
    console.log('Connected to memory server');
    
    try {
      // Store a test entity
      const storeResponse = await client.storeEntity({
        id: 'augment_test_entity',
        type: 'test',
        name: 'Augment Test Entity',
        content: 'This is a test entity from Augment',
        metadata: {
          source: 'augment',
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('Stored test entity:', storeResponse.result);
      
      // Get the entity back
      const getResponse = await client.getEntity('augment_test_entity');
      console.log('Retrieved test entity:', getResponse.result);
      
      // Search for entities
      const searchResponse = await client.searchByText('augment');
      console.log('Search results:', 
        searchResponse.result.results.map(r => r.entity.id));
      
      console.log('Test completed successfully');
      client.close();
      process.exit(0);
    } catch (error) {
      console.error('Test failed:', error);
      client.close();
      process.exit(1);
    }
  });
  
  client.on('error', (error) => {
    console.error('Connection error:', error);
    process.exit(1);
  });
  
  // Wait for 10 seconds then exit if not connected
  setTimeout(() => {
    console.error('Timed out waiting for connection');
    process.exit(1);
  }, 10000);
}

// Run the test
runTest();
