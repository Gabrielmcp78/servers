import * as vscode from 'vscode';
import { McpServerService, ServerStatus } from './mcpServerService.native';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _mcpServerService: McpServerService;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, mcpServerService: McpServerService) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'mcpDashboard',
      'MCP Native Servers Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, mcpServerService);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    mcpServerService: McpServerService
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._mcpServerService = mcpServerService;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the content based on view changes
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.visible) {
          this._update();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'startServer':
            await this._mcpServerService.startServer();
            this._update();
            break;
          case 'stopServer':
            await this._mcpServerService.stopServer();
            this._update();
            break;
          case 'restartServer':
            await this._mcpServerService.restartServer();
            this._update();
            break;
          case 'installNativeServers':
            await this._mcpServerService.installNativeServers();
            this._update();
            break;
          case 'refresh':
            this._update();
            break;
        }
      },
      null,
      this._disposables
    );

    // Listen for status changes
    this._disposables.push(
      mcpServerService.onStatusChanged(() => {
        this._update();
      })
    );
  }

  private _update() {
    const status = this._mcpServerService.getStatus();
    this._panel.webview.html = this._getHtmlForWebview(status);
  }

  private _getHtmlForWebview(status: ServerStatus) {
    const serverStatus = status.isRunning ? 'Online' : 'Offline';
    const statusClass = status.isRunning ? 'status-online' : 'status-offline';

    const mcpServerStatus = status.mcpServerRunning ? 'Online' : 'Offline';
    const mcpStatusClass = status.mcpServerRunning ? 'status-online' : 'status-offline';
    
    const memoryServerStatus = status.memoryServerRunning ? 'Online' : 'Offline';
    const memoryStatusClass = status.memoryServerRunning ? 'status-online' : 'status-offline';
    
    const commsServerStatus = status.commsServerRunning ? 'Online' : 'Offline';
    const commsStatusClass = status.commsServerRunning ? 'status-online' : 'status-offline';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MCP Native Servers Dashboard</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
        }
        .status-badge {
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
        }
        .status-online {
            background-color: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-terminal-foreground);
        }
        .status-offline {
            background-color: var(--vscode-terminal-ansiRed);
            color: var(--vscode-terminal-foreground);
        }
        .card {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .card-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 12px;
        }
        .stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
        }
        .stat-item {
            padding: 12px;
            background-color: var(--vscode-input-background);
            border-radius: 4px;
        }
        .stat-label {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            margin-top: 8px;
        }
        .server-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 16px;
            margin-bottom: 16px;
        }
        .server-item {
            padding: 16px;
            background-color: var(--vscode-input-background);
            border-radius: 4px;
        }
        .server-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 8px;
        }
        .server-status {
            display: flex;
            align-items: center;
            margin-top: 8px;
        }
        .server-status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 8px;
        }
        .button-container {
            display: flex;
            gap: 8px;
            margin-top: 16px;
        }
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .error-message {
            color: var(--vscode-errorForeground);
            margin-top: 8px;
        }
        .info-text {
            margin-top: 16px;
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">MCP Native Servers Dashboard</div>
        <div class="status-badge ${statusClass}">${serverStatus}</div>
    </div>

    <div class="card">
        <div class="card-title">Server Status</div>
        <div class="server-grid">
            <div class="server-item">
                <div class="server-name">MCP Server</div>
                <div class="server-status">
                    Status: <div class="server-status-badge ${mcpStatusClass}">${mcpServerStatus}</div>
                </div>
                <div class="info-text">
                    Socket: /Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock
                </div>
            </div>
            <div class="server-item">
                <div class="server-name">Memory Server</div>
                <div class="server-status">
                    Status: <div class="server-status-badge ${memoryStatusClass}">${memoryServerStatus}</div>
                </div>
                <div class="info-text">
                    Socket: /Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock
                </div>
            </div>
            <div class="server-item">
                <div class="server-name">Communication Server</div>
                <div class="server-status">
                    Status: <div class="server-status-badge ${commsStatusClass}">${commsServerStatus}</div>
                </div>
                <div class="info-text">
                    Socket: /Users/gabrielmcp/Library/Application Support/MCP/comms-server.sock
                </div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-title">Server Statistics</div>
        <div class="stat-grid">
            ${status.isRunning ? `
            <div class="stat-item">
                <div class="stat-label">Entities</div>
                <div class="stat-value">${status.entityCount || 0}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Relations</div>
                <div class="stat-value">${status.relationCount || 0}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Messages</div>
                <div class="stat-value">${status.messageCount || 0}</div>
            </div>
            ` : '<div class="info-text">No statistics available when servers are offline.</div>'}
        </div>
        ${status.lastError ? `<div class="error-message">Error: ${status.lastError}</div>` : ''}
    </div>

    <div class="card">
        <div class="card-title">Server Controls</div>
        <div class="button-container">
            <button id="startBtn" ${status.isRunning ? 'disabled' : ''}>Start Servers</button>
            <button id="stopBtn" ${!status.isRunning ? 'disabled' : ''}>Stop Servers</button>
            <button id="restartBtn">Restart Servers</button>
            <button id="installBtn">Install Native Servers</button>
            <button id="refreshBtn">Refresh</button>
        </div>
        <div class="info-text">
            The native servers are located in /Users/gabrielmcp/Library/Application Support/MCP.
            Logs are stored in /Users/gabrielmcp/Library/Application Support/MCP/logs.
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        document.getElementById('startBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'startServer' });
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'stopServer' });
        });

        document.getElementById('restartBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'restartServer' });
        });

        document.getElementById('installBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'installNativeServers' });
        });

        document.getElementById('refreshBtn').addEventListener('click', () => {
            vscode.postMessage({ command: 'refresh' });
        });

        // Auto-refresh every 10 seconds
        setInterval(() => {
            vscode.postMessage({ command: 'refresh' });
        }, 10000);
    </script>
</body>
</html>`;
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
