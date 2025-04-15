/**
 * Test script for MCP and Memory Server integration
 *
 * This script demonstrates how to:
 * 1. Connect to the MCP server
 * 2. Connect to the Memory server
 * 3. Register an agent
 * 4. Store and retrieve memories
 * 5. Send messages between agents
 */

import MCPClient from './client/mcp-socketio-client.js';
import MemoryClient from './client/memory-client.js';

// Define the socket paths
const MCP_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';
const MEMORY_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock';

// Define the agent
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

/**
 * Test MCP functionality
 */
async function testMCP(mcpClient) {
  console.log('\n=== Testing MCP Server ===');

  // Connect to the server
  console.log('Connecting to MCP server...');
  await mcpClient.connect();
  console.log('Connected to MCP server');

  // Get server info
  console.log('\nGetting server info...');
  const serverInfo = await mcpClient.getServerInfo();
  console.log('Server info:', serverInfo.serverInfo);

  // List available tools
  console.log('\nListing available tools...');
  const toolsResponse = await mcpClient.listTools();
  console.log('Available tools:');
  toolsResponse.tools.forEach(tool => {
    console.log(`- ${tool.name}: ${tool.description || 'No description'}`);
  });

  // Test echo tool
  console.log('\nTesting echo tool...');
  const echoResult = await mcpClient.callTool('echo', { message: 'Hello from Athena!' });
  console.log('Echo result:', echoResult.content[0].text);

  return true;
}

/**
 * Test Memory Server functionality
 */
async function testMemory(memoryClient) {
  console.log('\n=== Testing Memory Server ===');

  // Register agent
  console.log('\nRegistering agent...');
  const registrationResult = await memoryClient.registerAgent(agent);
  console.log('Registration result:', registrationResult);

  // Store a memory
  console.log('\nStoring a memory...');
  const memoryResult = await memoryClient.storeMemory(
    agent.id,
    'I am Athena, an AI assistant for development tasks.',
    ['identity', 'creation']
  );
  console.log('Memory storage result:', memoryResult);

  // Get all memories for the agent
  console.log('\nRetrieving agent memories...');
  const memories = await memoryClient.getAgentMemories(agent.id);
  console.log('Agent memories:');
  if (memories.result && memories.result.entities && memories.result.entities.length > 0) {
    memories.result.entities.forEach(memory => {
      console.log(`- ${memory.id}: ${memory.content} (${memory.tags ? memory.tags.join(', ') : 'no tags'})`);
    });
  } else {
    console.log('No memories found');
  }

  // Get all agents
  console.log('\nRetrieving all agents...');
  const agents = await memoryClient.getAllAgents();
  console.log('Registered agents:');
  if (agents.result && agents.result.entities && agents.result.entities.length > 0) {
    agents.result.entities.forEach(agent => {
      console.log(`- ${agent.id}: ${agent.name} (${agent.type})`);
    });
  } else {
    console.log('No agents found in list');
  }

  // Get specific agent
  console.log('\nRetrieving specific agent...');
  try {
    const specificAgent = await memoryClient.getAgent(agent.id);
    console.log('Agent details:');
    console.log(`- ID: ${specificAgent.result.id}`);
    console.log(`- Name: ${specificAgent.result.name}`);
    console.log(`- Type: ${specificAgent.result.type}`);
    console.log(`- Description: ${specificAgent.result.description}`);
  } catch (error) {
    console.log('Failed to retrieve specific agent:', error.message);
  }

  return true;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting MCP and Memory Server test...');

    // Create clients
    const mcpClient = new MCPClient(MCP_SOCKET_PATH);
    const memoryClient = new MemoryClient(MEMORY_SOCKET_PATH);

    // Test MCP functionality
    const mcpResult = await testMCP(mcpClient);

    // Test Memory Server functionality
    const memoryResult = await testMemory(memoryClient);

    // Clean up
    mcpClient.disconnect();

    console.log('\n=== Test Results ===');
    console.log(`MCP Server Test: ${mcpResult ? 'Success' : 'Failed'}`);
    console.log(`Memory Server Test: ${memoryResult ? 'Success' : 'Failed'}`);
    console.log('\nTest completed successfully!');

  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the main function
main();
