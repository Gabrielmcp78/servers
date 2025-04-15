// Universal macOS MCP Server with Socket.IO support
import http from 'http';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';

// Determine directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HOME_DIR = process.env.HOME || '/tmp';
const APP_SUPPORT_DIR = path.join(HOME_DIR, 'Library/Application Support/MCP');
const SOCKET_PATH = path.join(APP_SUPPORT_DIR, 'mcp-server.sock');
const DATA_DIR = path.join(APP_SUPPORT_DIR, 'data');
const LOG_DIR = path.join(APP_SUPPORT_DIR, 'logs');

// Ensure directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(LOG_DIR, { recursive: true });

// Set up logging
const logFile = path.join(LOG_DIR, 'server.log');
const errorFile = path.join(LOG_DIR, 'error.log');

// Custom logger
const logger = {
  log: (message) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] INFO: ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(message);
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    const errorMessage = `[${timestamp}] ERROR: ${message} ${error ? `\n${error.stack || error}` : ''}\n`;
    fs.appendFileSync(errorFile, errorMessage);
    console.error(message, error);
  }
};

// Remove socket if it exists
if (fs.existsSync(SOCKET_PATH)) {
  fs.unlinkSync(SOCKET_PATH);
}

// Setup Express
const app = express();
app.use(express.json());
const server = http.createServer(app);

// Store server state
let serverState = {
  startTime: new Date().toISOString(),
  connections: 0,
  totalRequests: 0
};

// Load saved state if exists
function loadState() {
  try {
    const statePath = path.join(DATA_DIR, 'server-state.json');
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf8');
      const savedState = JSON.parse(data);
      serverState = { ...serverState, ...savedState };
      logger.log(`Loaded state: ${JSON.stringify(serverState)}`);
    }
  } catch (error) {
    logger.error('Failed to load state:', error);
  }
}

// Save state periodically
function saveState() {
  try {
    const statePath = path.join(DATA_DIR, 'server-state.json');
    fs.writeFileSync(statePath, JSON.stringify(serverState, null, 2));
  } catch (error) {
    logger.error('Failed to save state:', error);
  }
}

// Set up periodic state saving
setInterval(saveState, 60000); // Save every minute

// Simple MCP Server implementation
class SimpleMcpServer {
  constructor(info) {
    this.info = info;
    this.tools = {};
  }
  
  // Register a tool
  tool(name, handler) {
    this.tools[name] = { name, handler };
    logger.log(`Registered tool: ${name}`);
    return {
      disable: () => { this.tools[name].disabled = true; },
      enable: () => { this.tools[name].disabled = false; },
      remove: () => { delete this.tools[name]; }
    };
  }
  
  // Get available tools
  getTools() {
    return Object.values(this.tools)
      .filter(tool => !tool.disabled)
      .map(tool => ({
        name: tool.name,
        description: tool.description || `Tool: ${tool.name}`
      }));
  }
  
  // Call a tool
  async callTool(name, args) {
    if (!this.tools[name] || this.tools[name].disabled) {
      return { error: `Tool not found: ${name}` };
    }
    try {
      return await this.tools[name].handler(args);
    } catch (error) {
      logger.error(`Error calling tool ${name}:`, error);
      return { 
        content: [{ type: "text", text: `Error calling tool: ${error.message}` }],
        isError: true
      };
    }
  }
}

// Create server instance
const mcpServer = new SimpleMcpServer({
  name: "Universal macOS MCP Server",
  version: "1.0.0"
});

// Register tools
mcpServer.tool("echo", async (args) => {
  logger.log(`Echo tool called with: ${JSON.stringify(args)}`);
  return {
    content: [{ type: "text", text: `Echo: ${args.message || "No message provided"}` }]
  };
});

mcpServer.tool("readFile", async (args) => {
  try {
    const filePath = args.path;
    // Ensure the file path is within the allowed directory
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      return {
        content: [{ type: "text", text: "Error: Invalid file path" }],
        isError: true
      };
    }
    
    const fullPath = path.join(DATA_DIR, normalizedPath);
    logger.log(`Reading file: ${fullPath}`);
    
    if (!fs.existsSync(fullPath)) {
      return {
        content: [{ type: "text", text: `Error: File not found: ${normalizedPath}` }],
        isError: true
      };
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    return {
      content: [{ type: "text", text: content }]
    };
  } catch (error) {
    logger.error(`Error reading file:`, error);
    return {
      content: [{ type: "text", text: `Error reading file: ${error.message}` }],
      isError: true
    };
  }
});

mcpServer.tool("writeFile", async (args) => {
  try {
    const filePath = args.path;
    const content = args.content;
    
    // Ensure the file path is within the allowed directory
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      return {
        content: [{ type: "text", text: "Error: Invalid file path" }],
        isError: true
      };
    }
    
    const fullPath = path.join(DATA_DIR, normalizedPath);
    const dirPath = path.dirname(fullPath);
    
    // Ensure directory exists
    fs.mkdirSync(dirPath, { recursive: true });
    
    logger.log(`Writing file: ${fullPath}`);
    fs.writeFileSync(fullPath, content);
    
    return {
      content: [{ type: "text", text: `Successfully wrote to ${normalizedPath}` }]
    };
  } catch (error) {
    logger.error(`Error writing file:`, error);
    return {
      content: [{ type: "text", text: `Error writing file: ${error.message}` }],
      isError: true
    };
  }
});

mcpServer.tool("listFiles", async (args) => {
  try {
    const directory = args.directory || '';
    
    // Ensure the directory path is within the allowed directory
    const normalizedDir = path.normalize(directory);
    if (normalizedDir.startsWith('..') || path.isAbsolute(normalizedDir)) {
      return {
        content: [{ type: "text", text: "Error: Invalid directory path" }],
        isError: true
      };
    }
    
    const fullPath = path.join(DATA_DIR, normalizedDir);
    
    if (!fs.existsSync(fullPath)) {
      return {
        content: [{ type: "text", text: `Error: Directory not found: ${normalizedDir}` }],
        isError: true
      };
    }
    
    logger.log(`Listing files in: ${fullPath}`);
    const files = fs.readdirSync(fullPath, { withFileTypes: true });
    
    const fileList = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      path: path.join(normalizedDir, file.name)
    }));
    
    return {
      content: [{ type: "text", text: JSON.stringify(fileList, null, 2) }]
    };
  } catch (error) {
    logger.error(`Error listing files:`, error);
    return {
      content: [{ type: "text", text: `Error listing files: ${error.message}` }],
      isError: true
    };
  }
});

// Track connections
const connections = {};

// Set up Socket.IO server
const io = new SocketIOServer(server, {
  path: '/socket.io',
  serveClient: false,
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  const socketId = socket.id;
  logger.log(`Socket.IO client connected: ${socketId}`);
  
  // Store Socket.IO connection
  connections[socketId] = { socket, type: 'socketio', lastActivity: Date.now() };
  serverState.connections++;
  
  // Handle MCP messages through Socket.IO
  socket.on('mcpMessage', async (message) => {
    try {
      serverState.totalRequests++;
      logger.log(`Received Socket.IO message: ${JSON.stringify(message)}`);
      
      let response;
      
      // Process different message types
      if (message.type === 'getServerInfo') {
        response = { 
          type: 'getServerInfoResponse',
          id: message.id,
          serverInfo: mcpServer.info
        };
      } 
      else if (message.type === 'listTools') {
        response = {
          type: 'listToolsResponse',
          id: message.id,
          tools: mcpServer.getTools()
        };
      }
      else if (message.type === 'callTool') {
        const result = await mcpServer.callTool(message.params.name, message.params.arguments);
        response = {
          type: 'callToolResponse',
          id: message.id,
          ...result
        };
      }
      else {
        response = {
          type: 'error',
          id: message.id,
          error: {
            message: `Unsupported message type: ${message.type}`
          }
        };
      }
      
      // Send the response back through Socket.IO
      socket.emit('mcpResponse', response);
    } catch (error) {
      logger.error(`Error processing Socket.IO message:`, error);
      socket.emit('mcpResponse', {
        type: 'error',
        id: message.id || 'unknown',
        error: {
          message: error.message
        }
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    delete connections[socketId];
    serverState.connections--;
    logger.log(`Socket.IO client disconnected: ${socketId}, remaining: ${serverState.connections}`);
  });
});

// SSE endpoint
app.get("/sse", (req, res) => {
  const sessionId = req.query.sessionId || Math.random().toString(36).substring(7);
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send initial connection message
  res.write(`event: connected\ndata: {"sessionId":"${sessionId}"}\n\n`);
  
  // Store the connection
  connections[sessionId] = { res, type: 'sse', lastActivity: Date.now() };
  serverState.connections++;
  
  logger.log(`SSE client connected: ${sessionId}, total: ${serverState.connections}`);
  
  // Handle connection close
  req.on('close', () => {
    delete connections[sessionId];
    serverState.connections--;
    logger.log(`SSE client disconnected: ${sessionId}, remaining: ${serverState.connections}`);
  });
  
  // Send ping every 30 seconds to keep connection alive
  const pingInterval = setInterval(() => {
    if (connections[sessionId]) {
      res.write(`event: ping\ndata: {}\n\n`);
      connections[sessionId].lastActivity = Date.now();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);
});

// Process MCP requests for SSE clients
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  
  if (!connections[sessionId] || connections[sessionId].type !== 'sse') {
    return res.status(400).json({ error: 'No SSE connection found for sessionId' });
  }
  
  serverState.totalRequests++;
  
  try {
    const message = req.body;
    logger.log(`Received SSE message: ${JSON.stringify(message)}`);
    
    // Handle different MCP message types
    let response;
    
    if (message.type === 'getServerInfo') {
      response = { 
        type: 'getServerInfoResponse',
        id: message.id,
        serverInfo: mcpServer.info
      };
    } 
    else if (message.type === 'listTools') {
      response = {
        type: 'listToolsResponse',
        id: message.id,
        tools: mcpServer.getTools()
      };
    }
    else if (message.type === 'callTool') {
      const result = await mcpServer.callTool(message.params.name, message.params.arguments);
      response = {
        type: 'callToolResponse',
        id: message.id,
        ...result
      };
    }
    else {
      response = {
        type: 'error',
        id: message.id,
        error: {
          message: `Unsupported message type: ${message.type}`
        }
      };
    }
    
    // Send response via SSE
    const conn = connections[sessionId];
    if (conn && conn.res) {
      conn.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
    }
    
    // Also respond to HTTP request
    res.json({ status: 'ok' });
  } catch (error) {
    logger.error(`Error processing SSE message:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get("/health", (_, res) => {
  const healthData = {
    status: 'ok',
    uptime: process.uptime(),
    startTime: serverState.startTime,
    connections: Object.keys(connections).length,
    totalRequests: serverState.totalRequests,
    connTypes: Object.values(connections).reduce((acc, conn) => {
      acc[conn.type] = (acc[conn.type] || 0) + 1;
      return acc;
    }, {}),
    memoryUsage: process.memoryUsage()
  };
  
  res.status(200).json(healthData);
  logger.log(`Health check: ${JSON.stringify(healthData)}`);
});

// Initialize the server
async function initializeServer() {
  try {
    // Load saved state
    loadState();
    
    // Start the server on the Unix socket
    server.listen(SOCKET_PATH, () => {
      // Set socket permissions
      fs.chmodSync(SOCKET_PATH, 0o777);
      logger.log(`MCP Server running on socket: ${SOCKET_PATH}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', { promise, reason });
    });
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
function handleShutdown() {
  logger.log('Shutting down server...');
  
  // Save state
  saveState();
  
  // Close all connections
  Object.values(connections).forEach(conn => {
    try {
      if (conn.type === 'sse' && conn.res) {
        conn.res.end();
      } else if (conn.type === 'socketio' && conn.socket) {
        conn.socket.disconnect(true);
      }
    } catch (error) {
      logger.error('Error closing connection:', error);
    }
  });
  
  // Close server
  server.close(() => {
    logger.log('Server closed');
    
    // Remove socket file
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH);
    }
    
    process.exit(0);
  });
  
  // Force exit if server doesn't close in 5 seconds
  setTimeout(() => {
    logger.error('Forced server shutdown after timeout');
    process.exit(1);
  }, 5000);
}

// Start the server
initializeServer().catch(error => {
  logger.error('Server initialization failed:', error);
  process.exit(1);
});
