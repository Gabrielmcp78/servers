/**
 * Install MCP Native Servers
 * 
 * This script installs the MCP native servers startup script and configures it to run at login.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Base directory for MCP
const MCP_BASE_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'MCP');
const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents');

// Ensure directories exist
if (!fs.existsSync(path.join(MCP_BASE_DIR, 'logs'))) {
  fs.mkdirSync(path.join(MCP_BASE_DIR, 'logs'), { recursive: true });
}

if (!fs.existsSync(LAUNCH_AGENTS_DIR)) {
  fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
}

// Copy the startup script
const scriptSource = path.join(__dirname, 'mcp-native-servers.js');
const scriptDest = path.join(MCP_BASE_DIR, 'mcp-native-servers.js');

fs.copyFileSync(scriptSource, scriptDest);
fs.chmodSync(scriptDest, '755'); // Make executable

console.log(`Copied startup script to ${scriptDest}`);

// Create LaunchAgent plist
const plistPath = path.join(LAUNCH_AGENTS_DIR, 'com.mcp.native-servers.plist');
const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mcp.native-servers</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${scriptDest}</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${path.join(MCP_BASE_DIR, 'logs', 'launchd.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(MCP_BASE_DIR, 'logs', 'launchd-error.log')}</string>
    <key>WorkingDirectory</key>
    <string>${MCP_BASE_DIR}</string>
</dict>
</plist>`;

fs.writeFileSync(plistPath, plistContent);
console.log(`Created LaunchAgent at ${plistPath}`);

// Load the LaunchAgent
try {
  execSync(`launchctl unload -w ${plistPath}`, { stdio: 'ignore' });
} catch (error) {
  // Ignore errors if it wasn't loaded
}

try {
  execSync(`launchctl load -w ${plistPath}`);
  console.log('LaunchAgent loaded successfully');
} catch (error) {
  console.error('Failed to load LaunchAgent:', error.message);
}

// Start the servers
console.log('Starting MCP native servers...');
try {
  execSync(`node ${scriptDest} start`, { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to start servers:', error.message);
}

console.log('\nInstallation complete!');
console.log('\nUsage:');
console.log(`  Start servers:   node ${scriptDest} start`);
console.log(`  Stop servers:    node ${scriptDest} stop`);
console.log(`  Restart servers: node ${scriptDest} restart`);
console.log(`  Check status:    node ${scriptDest} status`);
console.log('\nThe servers will automatically start when you log in to your Mac.');
