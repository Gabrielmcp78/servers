/**
 * Register Athena in the MCP Memory System
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

// Configuration
const config = {
  mcpSocketPath: '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock',
  agent: {
    id: 'cline',
    name: 'Cline',
    type: 'assistant',
    description: 'AI assistant',
    capabilities: ['text', 'function_call', 'memory_access'],
    metadata: {
      creator: 'Gabriel McPherson',
      version: '1.0.0',
      created: new Date().toISOString(),
      permanent: true
    }
  }
};

// Helper function to send a request to a Unix socket
async function sendSocketRequest(socketPath, request) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath, () => {
      console.log(`Connected to ${socketPath}`);
      client.write(JSON.stringify(request));
    });

    let data = '';
    client.on('data', (chunk) => {
      data += chunk.toString();
    });

    client.on('end', () => {
      try {
        const response = JSON.parse(data);
        resolve(response);
      } catch (error) {
        reject(new Error(`Failed to parse response: ${error.message}`));
      }
    });

    client.on('error', (error) => {
      reject(error);
    });
  });
}

// Register Athena in the MCP system
async function registerInMCPSystem() {
  console.log('Registering Cline in the MCP system...');

  try {
    // Register agent
    const response = await sendSocketRequest(config.mcpSocketPath, {
      type: 'register_agent',
      data: {
        id: config.agent.id,
        name: config.agent.name,
        type: config.agent.type,
        description: config.agent.description,
        capabilities: config.agent.capabilities,
        metadata: config.agent.metadata
      }
    });

    console.log('MCP system registration response:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to register in MCP system:', error);
    return false;
  }
}

// Create memory directory for Athena
async function createMemoryDirectory() {
  console.log('Creating memory directory for Cline...');

  try {
    // Create directory
    const clineDir = path.join(__dirname, 'agents', 'cline');
    await fs.promises.mkdir(clineDir, { recursive: true });

    // Create initial memory file
    const initialMemory = {
      id: 'memory_initial',
      type: 'memory',
      content: 'I am Cline, an AI assistant.',
      timestamp: config.agent.metadata.created,
      tags: ['identity', 'creation']
    };

    await fs.promises.writeFile(
      path.join(clineDir, 'initial_memory.json'),
      JSON.stringify(initialMemory, null, 2)
    );

    console.log('Memory directory created successfully');
    return true;
  } catch (error) {
    console.error('Failed to create memory directory:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('Starting Cline registration process...');

  // Register in MCP system
  const mcpResult = await registerInMCPSystem();

  // Create memory directory
  const memoryResult = await createMemoryDirectory();

  // Report results
  console.log('\nRegistration Results:');
  console.log('---------------------');
  console.log(`MCP System: ${mcpResult ? 'Success' : 'Failed'}`);
  console.log(`Memory Directory: ${memoryResult ? 'Success' : 'Failed'}`);

  if (mcpResult && memoryResult) {
    console.log('\nCline has been successfully registered in the MCP system!');
  } else {
    console.log('\nCline registration was partially successful. Please check the logs for details.');
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
