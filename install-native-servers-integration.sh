#!/bin/bash

# Install Native Servers Integration
# This script installs the native servers integration into the MCP Status Bar extension

# Set variables
EXTENSION_DIR="mcp-status-bar"
NATIVE_SERVERS_DIR="native-servers"
MCP_BASE_DIR="$HOME/Library/Application Support/MCP"

# Create logs directory in MCP base dir if it doesn't exist
mkdir -p "$MCP_BASE_DIR/logs"

# Copy the native server script to the MCP directory
echo "Copying native server script to MCP directory..."
cp "$NATIVE_SERVERS_DIR/mcp-native-servers.js" "$MCP_BASE_DIR/"
chmod 755 "$MCP_BASE_DIR/mcp-native-servers.js"

# Copy the native server files to the extension
echo "Copying native server files to extension..."
cp "$NATIVE_SERVERS_DIR/mcpServerService.native.ts" "$EXTENSION_DIR/src/mcpServerService.native.ts"
cp "$NATIVE_SERVERS_DIR/dashboardPanel.native.ts" "$EXTENSION_DIR/src/dashboardPanel.native.ts"
cp "$NATIVE_SERVERS_DIR/extension.native.ts" "$EXTENSION_DIR/src/extension.native.ts"

# Update the extension's package.json to include the native servers commands
echo "Updating extension package.json..."
node -e "
const fs = require('fs');
const path = require('path');

// Read the package.json
const packageJsonPath = path.join('$EXTENSION_DIR', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add the native servers command
if (!packageJson.contributes.commands.find(cmd => cmd.command === 'mcpStatusBar.installNativeServers')) {
  packageJson.contributes.commands.push({
    command: 'mcpStatusBar.installNativeServers',
    title: 'MCP: Install Native Servers'
  });
}

// Add configuration for native servers
if (!packageJson.contributes.configuration.properties['mcpStatusBar.useNativeServers']) {
  packageJson.contributes.configuration.properties['mcpStatusBar.useNativeServers'] = {
    type: 'boolean',
    default: true,
    description: 'Use native MCP servers from ~/Library/Application Support/MCP'
  };
}

// Write the updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
"

# Update the extension's main file to use native servers
echo "Updating extension main file..."
cat > "$EXTENSION_DIR/src/extension.ts" << 'EOF'
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('MCP Status Bar extension is now active');

  // Check if we should use native servers
  const config = vscode.workspace.getConfiguration('mcpStatusBar');
  const useNativeServers = config.get('useNativeServers', true);

  if (useNativeServers) {
    // Use native servers
    const { activate: activateNative } = require('./extension.native');
    activateNative(context);
  } else {
    // Use original servers
    const { McpServerService } = require('./mcpServerService');
    const { DashboardPanel } = require('./dashboardPanel');
    const { StatusBarManager } = require('./statusBarManager');

    // Create the MCP server service
    const mcpServerService = new McpServerService();

    // Create the status bar manager
    const statusBarManager = new StatusBarManager(mcpServerService);

    // Register commands
    context.subscriptions.push(
      vscode.commands.registerCommand('mcpStatusBar.showDashboard', () => {
        DashboardPanel.createOrShow(context.extensionUri, mcpServerService);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('mcpStatusBar.startServer', async () => {
        try {
          await mcpServerService.startServer();
          vscode.window.showInformationMessage('MCP Server started');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to start MCP Server: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('mcpStatusBar.stopServer', async () => {
        try {
          await mcpServerService.stopServer();
          vscode.window.showInformationMessage('MCP Server stopped');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to stop MCP Server: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('mcpStatusBar.restartServer', async () => {
        try {
          await mcpServerService.restartServer();
          vscode.window.showInformationMessage('MCP Server restarted');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to restart MCP Server: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );

    // Add the service and manager to the subscriptions
    context.subscriptions.push(mcpServerService, statusBarManager);
  }
}

export function deactivate() {
  // This method is called when the extension is deactivated
}
EOF

# Build the extension
echo "Building the extension..."
cd "$EXTENSION_DIR" && npm run build

echo "Installation complete!"
echo "The MCP Status Bar extension now uses the native servers from $MCP_BASE_DIR"
echo "To switch back to the original servers, set mcpStatusBar.useNativeServers to false in VS Code settings"
