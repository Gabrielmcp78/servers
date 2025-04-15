/**
 * Athena Agent Client
 * 
 * A simple client for Athena to interact with the MCP memory server
 * and communicate with other agents like Cline.
 */

const net = require('net');
const fs = require('fs');
const readline = require('readline');

// Configuration
const MEMORY_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock';
const MCP_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';

// Athena agent details
const ATHENA = {
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

// Check if sockets exist
if (!fs.existsSync(MEMORY_SOCKET_PATH)) {
  console.error(`Memory server socket not found at ${MEMORY_SOCKET_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(MCP_SOCKET_PATH)) {
  console.error(`MCP server socket not found at ${MCP_SOCKET_PATH}`);
  process.exit(1);
}

/**
 * Send a request to the memory server
 */
async function sendMemoryRequest(request) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ path: MEMORY_SOCKET_PATH }, () => {
      console.log('Connected to memory server');
      client.write(JSON.stringify(request) + '\n');
    });
    
    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
    });
    
    client.on('end', () => {
      console.log('Disconnected from memory server');
      try {
        const response = JSON.parse(data);
        resolve(response);
      } catch (error) {
        reject(new Error(`Failed to parse response: ${error.message}`));
      }
    });
    
    client.on('error', (error) => {
      console.error('Memory server connection error:', error);
      reject(error);
    });
    
    // Add timeout
    setTimeout(() => {
      if (!client.destroyed) {
        client.destroy();
        reject(new Error('Request timed out'));
      }
    }, 5000);
  });
}

/**
 * Send a message to the MCP server
 */
async function sendMcpMessage(message) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ path: MCP_SOCKET_PATH }, () => {
      console.log('Connected to MCP server');
      client.write(JSON.stringify(message) + '\n');
    });
    
    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
    });
    
    client.on('end', () => {
      console.log('Disconnected from MCP server');
      try {
        const response = JSON.parse(data);
        resolve(response);
      } catch (error) {
        reject(new Error(`Failed to parse response: ${error.message}`));
      }
    });
    
    client.on('error', (error) => {
      console.error('MCP server connection error:', error);
      reject(error);
    });
    
    // Add timeout
    setTimeout(() => {
      if (!client.destroyed) {
        client.destroy();
        reject(new Error('Request timed out'));
      }
    }, 5000);
  });
}

/**
 * Register Athena with the memory server
 */
async function registerAthena() {
  console.log('Registering Athena with memory server...');
  
  const request = {
    operation: 'store_entity',
    params: {
      entity: {
        ...ATHENA,
        lastActive: new Date().toISOString()
      },
      context: 'system'
    }
  };
  
  try {
    const response = await sendMemoryRequest(request);
    console.log('Registration successful:', response.result.id);
    return response.result;
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
}

/**
 * Store a memory
 */
async function storeMemory(content, tags = []) {
  console.log(`Storing memory: ${content}`);
  
  const request = {
    operation: 'store_entity',
    params: {
      entity: {
        id: `memory_${Date.now()}`,
        type: 'memory',
        content,
        agentId: ATHENA.id,
        timestamp: new Date().toISOString(),
        tags
      },
      context: 'agent'
    }
  };
  
  try {
    const response = await sendMemoryRequest(request);
    console.log('Memory stored successfully:', response.result.id);
    return response.result;
  } catch (error) {
    console.error('Failed to store memory:', error);
    throw error;
  }
}

/**
 * Send a message to Cline
 */
async function sendMessageToCline(content) {
  console.log(`Sending message to Cline: ${content}`);
  
  const message = {
    type: 'callTool',
    id: Date.now().toString(),
    params: {
      name: 'sendMessage',
      arguments: {
        sender: ATHENA.id,
        recipients: ['cline'],
        content,
        timestamp: new Date().toISOString()
      }
    }
  };
  
  try {
    const response = await sendMcpMessage(message);
    console.log('Message sent successfully:', response);
    
    // Store the message in memory
    await storeMemory(`Message to Cline: ${content}`, ['message', 'sent', 'cline']);
    
    return response;
  } catch (error) {
    console.error('Failed to send message:', error);
    throw error;
  }
}

/**
 * List memories
 */
async function listMemories() {
  console.log('Listing memories...');
  
  const request = {
    operation: 'list_entities',
    params: {
      type: 'memory',
      context: 'agent'
    }
  };
  
  try {
    const response = await sendMemoryRequest(request);
    
    if (response.result && response.result.entities) {
      // Filter for Athena's memories
      const memories = response.result.entities.filter(
        memory => memory.agentId === ATHENA.id
      );
      
      console.log(`Found ${memories.length} memories:`);
      memories.forEach((memory, index) => {
        console.log(`${index + 1}. ${memory.content}`);
        console.log(`   Tags: ${memory.tags ? memory.tags.join(', ') : 'none'}`);
        console.log(`   Time: ${memory.timestamp}`);
        console.log('---');
      });
      
      return memories;
    } else {
      console.log('No memories found');
      return [];
    }
  } catch (error) {
    console.error('Failed to list memories:', error);
    throw error;
  }
}

/**
 * Run the interactive client
 */
async function runInteractiveClient() {
  try {
    // Register Athena
    await registerAthena();
    
    // Create interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n=== Athena Interactive Mode ===');
    console.log('Available commands:');
    console.log('1. send <message> - Send a message to Cline');
    console.log('2. memory <content> - Store a new memory');
    console.log('3. memories - List all memories');
    console.log('4. exit - Exit the client');
    
    const promptUser = () => {
      rl.question('\nEnter command: ', async (input) => {
        const parts = input.trim().split(' ');
        const command = parts[0].toLowerCase();
        
        try {
          if (command === 'exit') {
            console.log('Goodbye!');
            rl.close();
            process.exit(0);
          }
          else if (command === 'send') {
            if (parts.length < 2) {
              console.log('Invalid format. Use: send <message>');
            } else {
              const message = parts.slice(1).join(' ');
              await sendMessageToCline(message);
            }
          }
          else if (command === 'memory') {
            if (parts.length < 2) {
              console.log('Invalid format. Use: memory <content>');
            } else {
              const content = parts.slice(1).join(' ');
              await storeMemory(content, ['user_input']);
            }
          }
          else if (command === 'memories') {
            await listMemories();
          }
          else {
            console.log('Unknown command. Try send, memory, memories, or exit.');
          }
        } catch (error) {
          console.error('Error:', error.message);
        }
        
        promptUser();
      });
    };
    
    promptUser();
    
  } catch (error) {
    console.error('Error during startup:', error);
    process.exit(1);
  }
}

// Run the interactive client
runInteractiveClient();
