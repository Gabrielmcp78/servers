/**
 * Register with Memory Server (CommonJS version)
 */

const net = require('net');
const fs = require('fs');
const path = require('path');

// Configuration
const MEMORY_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock';

// Check if socket exists
if (!fs.existsSync(MEMORY_SOCKET_PATH)) {
  console.error(`Error: Memory Socket not found at ${MEMORY_SOCKET_PATH}`);
  process.exit(1);
}

// Agent configuration
const agent = {
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

// Connect to memory server and register
function registerWithMemoryServer() {
  return new Promise((resolve, reject) => {
    console.log('Connecting to memory server...');
    
    const client = net.createConnection({ path: MEMORY_SOCKET_PATH }, () => {
      console.log('Connected to memory server');
      
      // Create registration request
      const request = {
        operation: 'store_entity',
        params: {
          entity: {
            ...agent,
            lastActive: new Date().toISOString()
          },
          context: 'system'
        }
      };
      
      console.log('Sending registration request:', JSON.stringify(request, null, 2));
      client.write(JSON.stringify(request) + '\n');
    });
    
    let buffer = '';
    client.on('data', (data) => {
      buffer += data.toString();
      console.log('Received data chunk:', data.toString());
      
      try {
        const response = JSON.parse(buffer);
        console.log('Registration response:', JSON.stringify(response, null, 2));
        client.end();
        resolve(response);
      } catch (error) {
        // Incomplete JSON, wait for more data
      }
    });
    
    client.on('error', (error) => {
      console.error('Memory server connection error:', error);
      reject(error);
    });
    
    client.on('end', () => {
      console.log('Disconnected from memory server');
      if (buffer && !buffer.includes('{')) {
        reject(new Error('Invalid response from memory server'));
      }
    });
    
    // Add timeout
    setTimeout(() => {
      if (client.connecting) {
        client.end();
        reject(new Error('Connection timeout'));
      }
    }, 5000);
  });
}

// Create initial memory
function createInitialMemory() {
  return new Promise((resolve, reject) => {
    console.log('Creating initial memory...');
    
    const client = net.createConnection({ path: MEMORY_SOCKET_PATH }, () => {
      console.log('Connected to memory server');
      
      // Create memory request
      const request = {
        operation: 'store_entity',
        params: {
          entity: {
            id: `memory_${Date.now()}`,
            type: 'memory',
            content: 'I am Athena, an AI assistant for development tasks.',
            agentId: agent.id,
            timestamp: new Date().toISOString(),
            tags: ['identity', 'creation']
          },
          context: 'agent'
        }
      };
      
      console.log('Sending memory creation request:', JSON.stringify(request, null, 2));
      client.write(JSON.stringify(request) + '\n');
    });
    
    let buffer = '';
    client.on('data', (data) => {
      buffer += data.toString();
      console.log('Received data chunk:', data.toString());
      
      try {
        const response = JSON.parse(buffer);
        console.log('Memory creation response:', JSON.stringify(response, null, 2));
        client.end();
        resolve(response);
      } catch (error) {
        // Incomplete JSON, wait for more data
      }
    });
    
    client.on('error', (error) => {
      console.error('Memory server connection error:', error);
      reject(error);
    });
    
    client.on('end', () => {
      console.log('Disconnected from memory server');
      if (buffer && !buffer.includes('{')) {
        reject(new Error('Invalid response from memory server'));
      }
    });
    
    // Add timeout
    setTimeout(() => {
      if (client.connecting) {
        client.end();
        reject(new Error('Connection timeout'));
      }
    }, 5000);
  });
}

// Main function
async function main() {
  try {
    console.log('Starting registration process...');
    
    // Step 1: Register with memory server
    console.log('\n=== Step 1: Register with Memory Server ===');
    const registrationResult = await registerWithMemoryServer();
    console.log('Registration completed:', registrationResult);
    
    // Step 2: Create initial memory
    console.log('\n=== Step 2: Create Initial Memory ===');
    const memoryResult = await createInitialMemory();
    console.log('Memory creation completed:', memoryResult);
    
    console.log('\nProcess completed successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the main function
main();
