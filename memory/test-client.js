/**
 * MCP Memory Server - Test Client
 * 
 * A simple client to test the memory server
 */

const net = require('net');
const path = require('path');

// Socket path
const socketPath = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock';

// Create a client
const client = net.createConnection({ path: socketPath }, () => {
  console.log('Connected to memory server');
  
  // Test storing an entity
  const testEntity = {
    id: 'test_entity_1',
    type: 'test',
    name: 'Test Entity',
    content: 'This is a test entity',
    metadata: {
      source: 'test-client',
      tags: ['test', 'example']
    }
  };
  
  // Send a request to store the entity
  const storeRequest = {
    operation: 'store_entity',
    params: {
      entity: testEntity,
      context: 'shared'
    }
  };
  
  console.log('Sending store request:', JSON.stringify(storeRequest, null, 2));
  client.write(JSON.stringify(storeRequest) + '\n');
});

// Handle data from the server
let buffer = '';
client.on('data', (data) => {
  buffer += data.toString();
  
  try {
    // Try to parse complete JSON messages
    const response = JSON.parse(buffer);
    buffer = '';
    
    console.log('Received response:', JSON.stringify(response, null, 2));
    
    // If store was successful, try to retrieve the entity
    if (response.operation === 'store_entity' && !response.error) {
      console.log('Entity stored successfully');
      
      // Send a request to get the entity
      const getRequest = {
        operation: 'get_entity',
        params: {
          id: 'test_entity_1'
        }
      };
      
      console.log('Sending get request:', JSON.stringify(getRequest, null, 2));
      client.write(JSON.stringify(getRequest) + '\n');
    } else if (response.operation === 'get_entity' && !response.error) {
      console.log('Entity retrieved successfully');
      
      // Create a relationship
      const testRelationship = {
        sourceId: 'test_entity_1',
        targetId: 'test_entity_2',
        type: 'related_to',
        properties: {
          strength: 0.8,
          description: 'Test relationship'
        }
      };
      
      // First, create another entity
      const testEntity2 = {
        id: 'test_entity_2',
        type: 'test',
        name: 'Test Entity 2',
        content: 'This is another test entity',
        metadata: {
          source: 'test-client',
          tags: ['test', 'example']
        }
      };
      
      // Send a request to store the second entity
      const storeRequest2 = {
        operation: 'store_entity',
        params: {
          entity: testEntity2,
          context: 'shared'
        }
      };
      
      console.log('Sending store request for second entity:', JSON.stringify(storeRequest2, null, 2));
      client.write(JSON.stringify(storeRequest2) + '\n');
    } else if (response.operation === 'store_entity' && response.result.id === 'test_entity_2') {
      console.log('Second entity stored successfully');
      
      // Now create the relationship
      const createRelationshipRequest = {
        operation: 'create_relationship',
        params: {
          relationship: {
            sourceId: 'test_entity_1',
            targetId: 'test_entity_2',
            type: 'related_to',
            properties: {
              strength: 0.8,
              description: 'Test relationship'
            }
          }
        }
      };
      
      console.log('Sending create relationship request:', JSON.stringify(createRelationshipRequest, null, 2));
      client.write(JSON.stringify(createRelationshipRequest) + '\n');
    } else if (response.operation === 'create_relationship' && !response.error) {
      console.log('Relationship created successfully');
      
      // Test traversing the graph
      const traverseRequest = {
        operation: 'traverse_graph',
        params: {
          startEntityId: 'test_entity_1',
          maxDepth: 2,
          direction: 'both'
        }
      };
      
      console.log('Sending traverse graph request:', JSON.stringify(traverseRequest, null, 2));
      client.write(JSON.stringify(traverseRequest) + '\n');
    } else if (response.operation === 'traverse_graph' && !response.error) {
      console.log('Graph traversal successful');
      console.log('Found entities:', response.result.entities.map(e => e.id));
      console.log('Found relationships:', response.result.relationships.map(r => r.id));
      
      // Test search
      const searchRequest = {
        operation: 'search_by_text',
        params: {
          query: 'test entity',
          options: {
            limit: 10
          }
        }
      };
      
      console.log('Sending search request:', JSON.stringify(searchRequest, null, 2));
      client.write(JSON.stringify(searchRequest) + '\n');
    } else if (response.operation === 'search_by_text' && !response.error) {
      console.log('Search successful');
      console.log('Search results:', response.result.results.map(r => r.entity.id));
      
      // All tests completed
      console.log('All tests completed successfully');
      client.end();
    } else if (response.error) {
      console.error('Error:', response.message);
      client.end();
    }
  } catch (error) {
    // Incomplete JSON, wait for more data
  }
});

// Handle connection close
client.on('end', () => {
  console.log('Disconnected from memory server');
});

// Handle errors
client.on('error', (error) => {
  console.error('Error:', error.message);
});
