/**
 * Register with Memory Server and Send Message to Cline
 *
 * This script demonstrates how to:
 * 1. Register an agent with the MCP Memory Server
 * 2. Send a message to Cline using the Communications Module
 */

const net = require('net');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  memorySocketPath: '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock',
  mcpSocketPath: '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock',
  agent: {
    id: 'athena_agent',
    name: 'Athena',
    type: 'assistant',
    description: 'Athena AI assistant',
    capabilities: ['text', 'function_call', 'memory_access'],
    metadata: {
      creator: 'Gabriel McPherson',
      version: '1.0.0',
      created: new Date().toISOString(),
      permanent: true
    }
  },
  message: {
    content: 'Hello Cline! This is a message from Athena.',
    recipients: ['cline']
  }
};

// Helper function to send a request to a Unix socket
async function sendSocketRequest(socketPath, request) {
  return new Promise((resolve, reject) => {
    console.log(`Connecting to socket: ${socketPath}`);
    console.log(`Sending request: ${JSON.stringify(request, null, 2)}`);

    const client = net.createConnection(socketPath, () => {
      console.log(`Connected to ${socketPath}`);
      const requestStr = JSON.stringify(request) + '\n';
      console.log(`Writing request: ${requestStr}`);
      client.write(requestStr);
    });

    let data = '';
    client.on('data', (chunk) => {
      console.log(`Received data chunk: ${chunk.toString()}`);
      data += chunk.toString();
    });

    client.on('end', () => {
      console.log(`Connection ended. Received data: ${data}`);
      try {
        const response = JSON.parse(data);
        console.log(`Parsed response: ${JSON.stringify(response, null, 2)}`);
        resolve(response);
      } catch (error) {
        console.error(`Failed to parse response: ${error.message}`);
        reject(new Error(`Failed to parse response: ${error.message}`));
      }
    });

    client.on('error', (error) => {
      console.error(`Socket error: ${error.message}`);
      reject(error);
    });

    // Add timeout to prevent hanging
    setTimeout(() => {
      console.log('Request timed out after 10 seconds');
      client.end();
      reject(new Error('Request timed out'));
    }, 10000);
  });
}

// Register agent with the memory server
async function registerWithMemoryServer() {
  console.log('Registering with memory server...');

  try {
    // Check if memory server socket exists
    if (!fs.existsSync(config.memorySocketPath)) {
      console.error(`Memory server socket not found at ${config.memorySocketPath}`);
      return false;
    }

    // Register agent
    const request = {
      operation: 'store_entity',
      params: {
        entity: {
          ...config.agent,
          type: 'agent',
          lastActive: new Date().toISOString()
        },
        context: 'system'
      }
    };

    const response = await sendSocketRequest(config.memorySocketPath, request);
    console.log('Memory server registration response:', JSON.stringify(response, null, 2));

    // Create initial memory
    const memoryRequest = {
      operation: 'store_entity',
      params: {
        entity: {
          id: `memory_${Date.now()}`,
          type: 'memory',
          content: 'I am Athena, an AI assistant.',
          agentId: config.agent.id,
          timestamp: new Date().toISOString(),
          tags: ['identity', 'creation']
        },
        context: 'agent'
      }
    };

    const memoryResponse = await sendSocketRequest(config.memorySocketPath, memoryRequest);
    console.log('Memory creation response:', JSON.stringify(memoryResponse, null, 2));

    return true;
  } catch (error) {
    console.error('Failed to register with memory server:', error);
    return false;
  }
}

// Send message to Cline
async function sendMessageToCline() {
  console.log('Sending message to Cline...');

  try {
    // Check if MCP server socket exists
    if (!fs.existsSync(config.mcpSocketPath)) {
      console.error(`MCP server socket not found at ${config.mcpSocketPath}`);
      return false;
    }

    // Send message
    const request = {
      type: 'callTool',
      params: {
        name: 'sendMessage',
        arguments: {
          sender: config.agent.id,
          recipients: config.message.recipients,
          content: config.message.content,
          timestamp: new Date().toISOString()
        }
      }
    };

    const response = await sendSocketRequest(config.mcpSocketPath, request);
    console.log('Message sending response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to send message to Cline:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('Starting registration and message sending process...');

  // Register with memory server
  const memoryResult = await registerWithMemoryServer();

  // Send message to Cline
  const messageResult = await sendMessageToCline();

  // Report results
  console.log('\nResults:');
  console.log('---------------------');
  console.log(`Memory Registration: ${memoryResult ? 'Success' : 'Failed'}`);
  console.log(`Message to Cline: ${messageResult ? 'Success' : 'Failed'}`);

  if (memoryResult && messageResult) {
    console.log('\nSuccessfully registered with memory server and sent message to Cline!');
  } else {
    console.log('\nProcess was partially successful. Please check the logs for details.');
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
