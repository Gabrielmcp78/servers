/**
 * Unix Socket Client for MCP Server
 * 
 * This client connects directly to the MCP server via Unix socket
 * without using Socket.IO.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';

// Define the Unix Socket path
const SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';

// Check if socket exists
if (!fs.existsSync(SOCKET_PATH)) {
  console.error(`Error: Socket not found at ${SOCKET_PATH}`);
  console.error('Make sure the MCP server is running.');
  process.exit(1);
}

/**
 * Make an HTTP request to the MCP server via Unix socket
 */
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    console.log(`Making ${method} request to ${path}`);
    
    const options = {
      socketPath: SOCKET_PATH,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Response status: ${res.statusCode}`);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = data ? JSON.parse(data) : {};
            resolve(parsedData);
          } catch (error) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP error: ${res.statusCode} - ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(error);
    });
    
    if (body) {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(bodyString);
    }
    
    req.end();
  });
}

/**
 * Get server information
 */
async function getServerInfo() {
  try {
    console.log('Getting server info...');
    const response = await makeRequest('GET', '/health');
    console.log('Server info:', response);
    return response;
  } catch (error) {
    console.error('Failed to get server info:', error);
    throw error;
  }
}

/**
 * Create an SSE connection to the server
 */
async function createSseConnection() {
  return new Promise((resolve, reject) => {
    console.log('Creating SSE connection...');
    
    const sessionId = Math.random().toString(36).substring(2, 15);
    console.log(`Session ID: ${sessionId}`);
    
    const options = {
      socketPath: SOCKET_PATH,
      path: `/sse?sessionId=${sessionId}`,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    };
    
    const req = http.request(options, (res) => {
      console.log(`SSE connection status: ${res.statusCode}`);
      
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to create SSE connection: ${res.statusCode}`));
        return;
      }
      
      // Set up event handling
      res.on('data', (chunk) => {
        const data = chunk.toString();
        console.log('SSE data:', data);
      });
      
      res.on('end', () => {
        console.log('SSE connection closed');
      });
      
      // Return the session ID and response object
      resolve({ sessionId, res });
    });
    
    req.on('error', (error) => {
      console.error('SSE connection error:', error);
      reject(error);
    });
    
    req.end();
  });
}

/**
 * Call a tool using the MCP server
 */
async function callTool(sessionId, toolName, args) {
  try {
    console.log(`Calling tool: ${toolName}`);
    
    const message = {
      type: 'callTool',
      id: Date.now().toString(),
      params: {
        name: toolName,
        arguments: args
      }
    };
    
    const response = await makeRequest('POST', `/messages?sessionId=${sessionId}`, message);
    console.log(`Tool response:`, response);
    return response;
  } catch (error) {
    console.error(`Failed to call tool ${toolName}:`, error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting Unix Socket Client...');
    
    // Get server info
    await getServerInfo();
    
    // Create SSE connection
    const { sessionId, res } = await createSseConnection();
    
    // Wait a moment for the connection to be established
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Call the echo tool
    await callTool(sessionId, 'echo', { message: 'Hello from Unix Socket Client!' });
    
    // Keep the connection open for a while to receive the response
    console.log('Waiting for response...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Close the connection
    res.destroy();
    console.log('Test completed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the main function
main();
