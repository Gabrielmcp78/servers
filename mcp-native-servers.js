/**
 * MCP Native Servers Startup Script
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Base directory for MCP
const MCP_BASE_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'MCP');

// Server configurations
const SERVERS = [
  {
    name: 'MCP Server',
    script: path.join(MCP_BASE_DIR, 'server', 'mcp-server.js'),
    args: [],
    socketPath: path.join(MCP_BASE_DIR, 'mcp-server.sock'),
    logFile: path.join(MCP_BASE_DIR, 'logs', 'mcp-server.log')
  },
  {
    name: 'Memory Server',
    script: path.join(MCP_BASE_DIR, 'memory-server-main.js'),
    args: [],
    socketPath: path.join(MCP_BASE_DIR, 'memory-server.sock'),
    logFile: path.join(MCP_BASE_DIR, 'logs', 'memory-server.log')
  },
  {
    name: 'Communication Server',
    script: path.join(MCP_BASE_DIR, 'comms', 'comms-server.js'),
    args: [],
    socketPath: path.join(MCP_BASE_DIR, 'comms-server.sock'),
    logFile: path.join(MCP_BASE_DIR, 'logs', 'comms-server.log')
  },
  {
    name: 'Filesystem Server',
    script: path.join(MCP_BASE_DIR, 'servers', 'filesystem-server', 'index.js'),
    args: [],
    socketPath: path.join(MCP_BASE_DIR, 'mcp-server.sock'), // Assuming the main server's socket
    logFile: path.join(MCP_BASE_DIR, 'logs', 'filesystem-server.log')
  }
];

// Ensure logs directory exists
if (!fs.existsSync(path.join(MCP_BASE_DIR, 'logs'))) {
  fs.mkdirSync(path.join(MCP_BASE_DIR, 'logs'), { recursive: true });
}

// Check if a server is already running
function isServerRunning(socketPath) {
  return fs.existsSync(socketPath);
}

// Start a server
function startServer(server) {
  console.log(`Starting ${server.name}...`);
  
  // Check if server is already running
  if (isServerRunning(server.socketPath)) {
    console.log(`${server.name} is already running.`);
    return;
  }
  
  // Create log file stream
  const logStream = fs.createWriteStream(server.logFile, { flags: 'a' });
  
  // Start the server process
  const process = spawn('node', [server.script, ...server.args], {
    cwd: MCP_BASE_DIR,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Pipe output to log file
  process.stdout.pipe(logStream);
  process.stderr.pipe(logStream);
  
  // Log process ID
  logStream.write(`\n[${new Date().toISOString()}] Starting ${server.name} (PID: ${process.pid})\n`);
  
  // Detach the process to run independently
  process.unref();
  
  console.log(`${server.name} started with PID ${process.pid}`);
}

// Stop a server
function stopServer(server) {
  console.log(`Stopping ${server.name}...`);
  
  // Check if server is running
  if (!isServerRunning(server.socketPath)) {
    console.log(`${server.name} is not running.`);
    return;
  }
  
  // Find process using the socket
  const findProcess = spawn('lsof', ['-U', server.socketPath]);
  let output = '';
  
  findProcess.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  findProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Failed to find process for ${server.name}`);
      return;
    }
    
    // Extract PID from lsof output
    const lines = output.split('\n');
    if (lines.length < 2) {
      console.error(`No process found for ${server.name}`);
      return;
    }
    
    const pidMatch = lines[1].match(/^\S+\s+(\d+)/);
    if (!pidMatch) {
      console.error(`Could not extract PID for ${server.name}`);
      return;
    }
    
    const pid = parseInt(pidMatch[1], 10);
    
    // Kill the process
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`${server.name} (PID: ${pid}) stopped.`);
      
      // Remove socket file
      if (fs.existsSync(server.socketPath)) {
        fs.unlinkSync(server.socketPath);
      }
    } catch (error) {
      console.error(`Failed to stop ${server.name}: ${error.message}`);
    }
  });
}

// Check status of all servers
function checkStatus() {
  console.log('Checking server status...');
  
  SERVERS.forEach(server => {
    const running = isServerRunning(server.socketPath);
    console.log(`${server.name}: ${running ? 'RUNNING' : 'STOPPED'}`);
  });
}

// Start all servers
function startAllServers() {
  console.log('Starting all MCP native servers...');
  SERVERS.forEach(startServer);
}

// Stop all servers
function stopAllServers() {
  console.log('Stopping all MCP native servers...');
  SERVERS.forEach(stopServer);
}

// Restart all servers
function restartAllServers() {
  console.log('Restarting all MCP native servers...');
  stopAllServers();
  
  // Wait for servers to stop before starting again
  setTimeout(startAllServers, 3000);
}

// Parse command line arguments
const command = process.argv[2] || 'start';

switch (command.toLowerCase()) {
  case 'start':
    startAllServers();
    break;
  case 'stop':
    stopAllServers();
    break;
  case 'restart':
    restartAllServers();
    break;
  case 'status':
    checkStatus();
    break;
  default:
    console.log('Usage: node mcp-native-servers.js [start|stop|restart|status]');
    break;
}
