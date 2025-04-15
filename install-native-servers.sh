#!/bin/bash

# Simple script to install and start the native MCP servers

# Set variables
MCP_BASE_DIR="$HOME/Library/Application Support/MCP"

# Create logs directory
mkdir -p "$MCP_BASE_DIR/logs"

# Create the native server script
cat > "$MCP_BASE_DIR/mcp-native-servers.js" << 'SCRIPT'
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
SCRIPT

# Make the script executable
chmod 755 "$MCP_BASE_DIR/mcp-native-servers.js"
echo "Created native server script at $MCP_BASE_DIR/mcp-native-servers.js"

# Create the LaunchAgent
LAUNCH_AGENT_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_AGENT_DIR"

cat > "$LAUNCH_AGENT_DIR/com.mcp.native-servers.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mcp.native-servers</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${MCP_BASE_DIR}/mcp-native-servers.js</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${MCP_BASE_DIR}/logs/launchd.log</string>
    <key>StandardErrorPath</key>
    <string>${MCP_BASE_DIR}/logs/launchd-error.log</string>
    <key>WorkingDirectory</key>
    <string>${MCP_BASE_DIR}</string>
</dict>
</plist>
PLIST

echo "Created LaunchAgent at $LAUNCH_AGENT_DIR/com.mcp.native-servers.plist"

# Load the LaunchAgent
launchctl unload -w "$LAUNCH_AGENT_DIR/com.mcp.native-servers.plist" 2>/dev/null || true
launchctl load -w "$LAUNCH_AGENT_DIR/com.mcp.native-servers.plist"
echo "Loaded LaunchAgent"

# Start the servers
node "$MCP_BASE_DIR/mcp-native-servers.js" start
echo "Started native servers"

echo "Installation complete!"
echo "The MCP native servers are now running from $MCP_BASE_DIR"
echo "They will start automatically when you log in"
echo ""
echo "Usage:"
echo "  node $MCP_BASE_DIR/mcp-native-servers.js start   # Start all servers"
echo "  node $MCP_BASE_DIR/mcp-native-servers.js stop    # Stop all servers"
echo "  node $MCP_BASE_DIR/mcp-native-servers.js restart # Restart all servers"
echo "  node $MCP_BASE_DIR/mcp-native-servers.js status  # Check server status"
