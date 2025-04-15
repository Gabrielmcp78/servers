// Test HTTP client for MCP server
import http from 'http';
import net from 'net';

// Define the Unix Socket path
const SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';

// Function to make a request to the MCP server
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
        console.log(`Response headers:`, res.headers);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsedData = data ? JSON.parse(data) : {};
            console.log('Response data:', parsedData);
            resolve(parsedData);
          } catch (error) {
            console.log('Raw response:', data);
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

// Test the health endpoint
async function testHealth() {
  try {
    console.log('Testing health endpoint...');
    const health = await makeRequest('GET', '/health');
    console.log('Health check successful:', health);
    return true;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

// Test the echo tool
async function testEcho() {
  try {
    console.log('\nTesting echo tool...');
    const message = {
      type: 'callTool',
      id: Date.now().toString(),
      params: {
        name: 'echo',
        arguments: {
          message: 'Hello from HTTP client!'
        }
      }
    };
    
    const response = await makeRequest('POST', '/messages', message);
    console.log('Echo test successful:', response);
    return true;
  } catch (error) {
    console.error('Echo test failed:', error);
    return false;
  }
}

// Main function
async function main() {
  try {
    console.log('Starting HTTP client test...');
    
    // Test health endpoint
    const healthResult = await testHealth();
    
    // Test echo tool
    if (healthResult) {
      await testEcho();
    }
    
    console.log('\nTest completed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the main function
main();
