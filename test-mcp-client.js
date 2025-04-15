// MCP Client Test - Direct HTTP/SSE Version
import MCPClient from './client/mcp-socketio-client.js';

async function testMcpClient() {
  try {
    console.log('Testing MCP client...');

    // Create client instance
    const socketPath = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';
    const client = new MCPClient(socketPath);

    // Connect to the server
    console.log('Connecting to MCP server...');
    await client.connect();
    console.log('Connected to MCP server');

    // Test echo tool
    console.log('\nCalling echo tool...');
    const result = await client.callTool('echo', { message: 'Hello World' });
    console.log('Echo result:', result);

    // Test server info
    console.log('\nGetting server info...');
    const serverInfo = await client.getServerInfo();
    console.log('Server info:', serverInfo);

    // Test list tools
    console.log('\nListing available tools...');
    const tools = await client.listTools();
    console.log('Available tools:', tools);

    // Clean up
    client.disconnect();
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing MCP client:', error);
  }
}

// Run the test
testMcpClient();
