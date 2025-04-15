import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as os from 'os';

export interface ServerStatus {
  isRunning: boolean;
  mcpServerRunning: boolean;
  memoryServerRunning: boolean;
  commsServerRunning: boolean;
  entityCount?: number;
  relationCount?: number;
  messageCount?: number;
  uptime?: number;
  lastError?: string;
}

export class McpServerService implements vscode.Disposable {
  private statusCheckInterval: NodeJS.Timeout | undefined;
  private _status: ServerStatus = { 
    isRunning: false,
    mcpServerRunning: false,
    memoryServerRunning: false,
    commsServerRunning: false
  };
  private _onStatusChanged = new vscode.EventEmitter<ServerStatus>();

  public readonly onStatusChanged = this._onStatusChanged.event;

  constructor() {
    this.startStatusCheck();
  }

  private get config() {
    return vscode.workspace.getConfiguration('mcpStatusBar');
  }

  private get mcpBaseDir(): string {
    return path.join(os.homedir(), 'Library', 'Application Support', 'MCP');
  }

  private get refreshInterval(): number {
    return this.config.get('refreshInterval') || 10000;
  }

  private get mcpServerSocket(): string {
    return path.join(this.mcpBaseDir, 'mcp-server.sock');
  }

  private get memoryServerSocket(): string {
    return path.join(this.mcpBaseDir, 'memory-server.sock');
  }

  private get commsServerSocket(): string {
    return path.join(this.mcpBaseDir, 'comms-server.sock');
  }

  private get nativeServerScript(): string {
    return path.join(this.mcpBaseDir, 'mcp-native-servers.js');
  }

  private startStatusCheck() {
    // Clear any existing interval
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    // Set up a new interval
    this.statusCheckInterval = setInterval(async () => {
      await this.checkServerStatus();
    }, this.refreshInterval);

    // Do an immediate check
    this.checkServerStatus();
  }

  private async checkServerStatus(): Promise<void> {
    try {
      // Check if the server processes are running
      const mcpServerRunning = fs.existsSync(this.mcpServerSocket);
      const memoryServerRunning = fs.existsSync(this.memoryServerSocket);
      const commsServerRunning = fs.existsSync(this.commsServerSocket);
      
      // Overall status is true if any server is running
      const isRunning = mcpServerRunning || memoryServerRunning || commsServerRunning;

      let newStatus: ServerStatus = {
        isRunning,
        mcpServerRunning,
        memoryServerRunning,
        commsServerRunning
      };

      if (isRunning) {
        // If any server is running, try to get more detailed information
        try {
          const stats = await this.getServerStats();
          newStatus = { ...newStatus, ...stats };
        } catch (error) {
          console.error('Error getting server stats:', error);
        }
      }

      // Update the status and notify listeners if it changed
      if (JSON.stringify(this._status) !== JSON.stringify(newStatus)) {
        this._status = newStatus;
        this._onStatusChanged.fire(this._status);
      }
    } catch (error) {
      console.error('Error checking server status:', error);
      this._status = {
        isRunning: false,
        mcpServerRunning: false,
        memoryServerRunning: false,
        commsServerRunning: false,
        lastError: error instanceof Error ? error.message : String(error)
      };
      this._onStatusChanged.fire(this._status);
    }
  }

  private async getServerStats(): Promise<Partial<ServerStatus>> {
    try {
      // For memory server, check entity and relation counts
      if (this._status.memoryServerRunning) {
        // Read the knowledge graph data
        const dataDir = path.join(this.mcpBaseDir, 'memory', 'data');
        const entitiesDir = path.join(dataDir, 'entities');
        const relationsDir = path.join(dataDir, 'relationships');
        
        let entityCount = 0;
        let relationCount = 0;
        
        if (fs.existsSync(entitiesDir)) {
          // Count entity files
          const entityFiles = fs.readdirSync(entitiesDir).filter(f => f.endsWith('.json'));
          entityCount = entityFiles.length;
        }
        
        if (fs.existsSync(relationsDir)) {
          // Count relationship files
          const relationFiles = fs.readdirSync(relationsDir).filter(f => f.endsWith('.json'));
          relationCount = relationFiles.length;
        }
        
        // For comms server, check message count
        let messageCount = 0;
        if (this._status.commsServerRunning) {
          const messagesDir = path.join(this.mcpBaseDir, 'comms', 'messages');
          if (fs.existsSync(messagesDir)) {
            const messageFiles = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json'));
            messageCount = messageFiles.length;
          }
        }
        
        return {
          entityCount,
          relationCount,
          messageCount
        };
      }
      
      return {};
    } catch (error) {
      console.error('Error getting server stats:', error);
      return {};
    }
  }

  public async startServer(): Promise<void> {
    try {
      // Check if the native server script exists
      if (!fs.existsSync(this.nativeServerScript)) {
        throw new Error(`Native server script not found: ${this.nativeServerScript}`);
      }

      // Start the servers
      const process = child_process.spawn('node', [this.nativeServerScript, 'start'], {
        cwd: this.mcpBaseDir,
        detached: true,
        stdio: 'ignore'
      });
      
      // Unref the process so it can run independently of the extension
      process.unref();

      vscode.window.showInformationMessage('MCP Native Servers starting...');

      // Wait a moment for the servers to start up
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check the status
      await this.checkServerStatus();
      
      if (this._status.isRunning) {
        vscode.window.showInformationMessage('MCP Native Servers started successfully');
      } else {
        vscode.window.showWarningMessage('MCP Native Servers may not have started properly. Check logs for details.');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to start MCP Native Servers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  public async stopServer(): Promise<void> {
    try {
      // Check if the native server script exists
      if (!fs.existsSync(this.nativeServerScript)) {
        throw new Error(`Native server script not found: ${this.nativeServerScript}`);
      }

      // Stop the servers
      const process = child_process.spawn('node', [this.nativeServerScript, 'stop'], {
        cwd: this.mcpBaseDir,
        detached: true,
        stdio: 'ignore'
      });
      
      // Unref the process so it can run independently of the extension
      process.unref();

      vscode.window.showInformationMessage('MCP Native Servers stopping...');

      // Wait a moment for the servers to stop
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check the status
      await this.checkServerStatus();
      
      if (!this._status.isRunning) {
        vscode.window.showInformationMessage('MCP Native Servers stopped successfully');
      } else {
        vscode.window.showWarningMessage('MCP Native Servers may not have stopped properly. Check logs for details.');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to stop MCP Native Servers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  public async restartServer(): Promise<void> {
    try {
      // Check if the native server script exists
      if (!fs.existsSync(this.nativeServerScript)) {
        throw new Error(`Native server script not found: ${this.nativeServerScript}`);
      }

      // Restart the servers
      const process = child_process.spawn('node', [this.nativeServerScript, 'restart'], {
        cwd: this.mcpBaseDir,
        detached: true,
        stdio: 'ignore'
      });
      
      // Unref the process so it can run independently of the extension
      process.unref();

      vscode.window.showInformationMessage('MCP Native Servers restarting...');

      // Wait a moment for the servers to restart
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check the status
      await this.checkServerStatus();
      
      if (this._status.isRunning) {
        vscode.window.showInformationMessage('MCP Native Servers restarted successfully');
      } else {
        vscode.window.showWarningMessage('MCP Native Servers may not have restarted properly. Check logs for details.');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to restart MCP Native Servers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  public async installNativeServers(): Promise<void> {
    try {
      // Check if we're in the right directory
      const extensionDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!extensionDir) {
        throw new Error('No workspace folder found');
      }
      
      // Copy the native server scripts to the MCP directory
      const sourceScript = path.join(extensionDir, 'native-servers', 'mcp-native-servers.js');
      const destScript = this.nativeServerScript;
      
      if (!fs.existsSync(path.dirname(destScript))) {
        fs.mkdirSync(path.dirname(destScript), { recursive: true });
      }
      
      fs.copyFileSync(sourceScript, destScript);
      fs.chmodSync(destScript, '755'); // Make executable
      
      // Create the LaunchAgent
      const launchAgentDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
      const launchAgentPath = path.join(launchAgentDir, 'com.mcp.native-servers.plist');
      
      if (!fs.existsSync(launchAgentDir)) {
        fs.mkdirSync(launchAgentDir, { recursive: true });
      }
      
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mcp.native-servers</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>${destScript}</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${path.join(this.mcpBaseDir, 'logs', 'launchd.log')}</string>
    <key>StandardErrorPath</key>
    <string>${path.join(this.mcpBaseDir, 'logs', 'launchd-error.log')}</string>
    <key>WorkingDirectory</key>
    <string>${this.mcpBaseDir}</string>
</dict>
</plist>`;
      
      fs.writeFileSync(launchAgentPath, plistContent);
      
      // Load the LaunchAgent
      try {
        child_process.execSync(`launchctl unload -w ${launchAgentPath}`, { stdio: 'ignore' });
      } catch (error) {
        // Ignore errors if it wasn't loaded
      }
      
      child_process.execSync(`launchctl load -w ${launchAgentPath}`);
      
      vscode.window.showInformationMessage('MCP Native Servers installed and configured to start at login');
      
      // Start the servers
      await this.startServer();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to install MCP Native Servers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  public getStatus(): ServerStatus {
    return this._status;
  }

  public dispose() {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }

    this._onStatusChanged.dispose();
  }
}
