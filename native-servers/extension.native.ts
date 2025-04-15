import * as vscode from 'vscode';
import { McpServerService } from './mcpServerService.native';
import { DashboardPanel } from './dashboardPanel.native';
import { StatusBarManager } from '../mcp-status-bar/src/statusBarManager';

export function activate(context: vscode.ExtensionContext) {
  console.log('MCP Native Servers extension is now active');

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
        vscode.window.showInformationMessage('MCP Native Servers started');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to start MCP Native Servers: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpStatusBar.stopServer', async () => {
      try {
        await mcpServerService.stopServer();
        vscode.window.showInformationMessage('MCP Native Servers stopped');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to stop MCP Native Servers: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpStatusBar.restartServer', async () => {
      try {
        await mcpServerService.restartServer();
        vscode.window.showInformationMessage('MCP Native Servers restarted');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to restart MCP Native Servers: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('mcpStatusBar.installNativeServers', async () => {
      try {
        await mcpServerService.installNativeServers();
        vscode.window.showInformationMessage('MCP Native Servers installed');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to install MCP Native Servers: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  // Add the service and manager to the subscriptions
  context.subscriptions.push(mcpServerService, statusBarManager);
}

export function deactivate() {
  // This method is called when the extension is deactivated
}
