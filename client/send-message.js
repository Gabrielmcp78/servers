import MCPSocketIOClient from './mcp-socketio-client.js';

async function sendMessage() {
  const client = new MCPSocketIOClient('/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock');

  try {
    await client.connect();

    const message = {
      type: 'testMessage',
      content: 'Hello from Cline!'
    };

    const response = await client.sendMessage(message);
    console.log('Response:', response);

    client.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

sendMessage();
