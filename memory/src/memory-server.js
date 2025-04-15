/**
 * MCP Memory Server
 * 
 * Main entry point for the memory module
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

// Import core components
const StorageManager = require('./storage-manager');
const KnowledgeGraph = require('./knowledge-graph');
const QueryEngine = require('./query-engine');

class MemoryServer {
  constructor(options = {}) {
    // Load configuration
    this.config = this._loadConfig(options.configPath);
    
    // Set up logger
    this.logger = options.logger || console;
    
    // Create error handler
    this.errorHandler = (error, context = {}) => {
      this.logger.error(`Error in ${context.module || 'unknown'}: ${error.message}`, {
        error,
        context
      });
      
      return {
        error: true,
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR',
        context: context.public || {}
      };
    };
    
    // Initialize components
    this.storageManager = new StorageManager({
      basePath: this.config.storage.basePath,
      logger: this.logger,
      errorHandler: this.errorHandler
    });
    
    this.knowledgeGraph = new KnowledgeGraph({
      storageManager: this.storageManager,
      logger: this.logger,
      errorHandler: this.errorHandler
    });
    
    this.queryEngine = new QueryEngine({
      storageManager: this.storageManager,
      knowledgeGraph: this.knowledgeGraph,
      logger: this.logger,
      errorHandler: this.errorHandler
    });
    
    // Initialize server state
    this.isRunning = false;
    this.unixServer = null;
    
    // Register request handlers
    this.requestHandlers = {
      // Entity operations
      'store_entity': this._handleStoreEntity.bind(this),
      'get_entity': this._handleGetEntity.bind(this),
      'update_entity': this._handleUpdateEntity.bind(this),
      'delete_entity': this._handleDeleteEntity.bind(this),
      'list_entities': this._handleListEntities.bind(this),
      
      // Relationship operations
      'create_relationship': this._handleCreateRelationship.bind(this),
      'get_relationship': this._handleGetRelationship.bind(this),
      'update_relationship': this._handleUpdateRelationship.bind(this),
      'delete_relationship': this._handleDeleteRelationship.bind(this),
      'list_relationships': this._handleListRelationships.bind(this),
      
      // Query operations
      'search_by_text': this._handleSearchByText.bind(this),
      'search_by_vector': this._handleSearchByVector.bind(this),
      'search_by_metadata': this._handleSearchByMetadata.bind(this),
      'traverse_graph': this._handleTraverseGraph.bind(this),
      
      // Agent operations
      'findEntitiesByAgentId': this._handleFindEntitiesByAgentId.bind(this),
      'getAgentMemory': this._handleGetAgentMemory.bind(this),
      'storeAgentMemory': this._handleStoreAgentMemory.bind(this)
    };
  }
  
  /**
   * Load configuration
   */
  _loadConfig(configPath) {
    const defaultConfigPath = path.join(
      process.env.HOME,
      'Library/Application Support/MCP/memory/memory-config.json'
    );
    
    const configFilePath = configPath || defaultConfigPath;
    
    try {
      if (fs.existsSync(configFilePath)) {
        const configData = fs.readFileSync(configFilePath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      this.logger.warn(`Failed to load config from ${configFilePath}`, error);
    }
    
    // If config file doesn't exist or is invalid, use default config
    return {
      server: {
        socketPath: '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock',
        logLevel: 'info'
      },
      storage: {
        basePath: '/Users/gabrielmcp/Library/Application Support/MCP/memory',
        backupInterval: '1h',
        maxBackups: 24
      },
      indices: {
        enableTextIndex: true,
        enableVectorIndex: true,
        enableMetadataIndex: true
      },
      vectorization: {
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        batchSize: 10
      }
    };
  }
  
  /**
   * Start the server
   */
  async start() {
    try {
      if (this.isRunning) {
        this.logger.warn('Memory server is already running');
        return;
      }
      
      // Initialize components
      await this.storageManager.initialize();
      await this.knowledgeGraph.initialize();
      await this.queryEngine.initialize();
      
      // Start Unix socket server
      await this._startUnixSocketServer();
      
      this.isRunning = true;
      this.logger.info('Memory server started successfully');
    } catch (error) {
      this.logger.error('Failed to start memory server', error);
      throw error;
    }
  }
  
  /**
   * Stop the server
   */
  async stop() {
    try {
      if (!this.isRunning) {
        this.logger.warn('Memory server is not running');
        return;
      }
      
      // Stop Unix socket server
      if (this.unixServer) {
        this.unixServer.close();
        this.unixServer = null;
        
        // Remove socket file
        if (fs.existsSync(this.config.server.socketPath)) {
          fs.unlinkSync(this.config.server.socketPath);
        }
      }
      
      this.isRunning = false;
      this.logger.info('Memory server stopped successfully');
    } catch (error) {
      this.logger.error('Failed to stop memory server', error);
      throw error;
    }
  }
  
  /**
   * Start Unix socket server
   */
  async _startUnixSocketServer() {
    return new Promise((resolve, reject) => {
      try {
        // Create socket directory if it doesn't exist
        const socketDir = path.dirname(this.config.server.socketPath);
        if (!fs.existsSync(socketDir)) {
          fs.mkdirSync(socketDir, { recursive: true });
        }
        
        // Remove existing socket file if it exists
        if (fs.existsSync(this.config.server.socketPath)) {
          fs.unlinkSync(this.config.server.socketPath);
        }
        
        // Create server
        this.unixServer = net.createServer((socket) => {
          this.logger.debug('Client connected to Unix socket');
          
          let buffer = '';
          
          socket.on('data', (data) => {
            buffer += data.toString();
            
            // Try to parse complete JSON messages
            let message;
            try {
              message = JSON.parse(buffer);
              buffer = '';
            } catch (error) {
              // Incomplete JSON, wait for more data
              return;
            }
            
            // Process message
            this._handleRequest(message)
              .then(response => {
                socket.write(JSON.stringify(response) + '\n');
              })
              .catch(error => {
                socket.write(JSON.stringify({
                  error: true,
                  message: error.message
                }) + '\n');
              });
          });
          
          socket.on('error', (error) => {
            this.logger.error('Unix socket error', error);
          });
          
          socket.on('close', () => {
            this.logger.debug('Client disconnected from Unix socket');
          });
        });
        
        // Start listening
        this.unixServer.listen(this.config.server.socketPath, () => {
          this.logger.info(`Memory server Unix socket listening at ${this.config.server.socketPath}`);
          resolve();
        });
        
        this.unixServer.on('error', (error) => {
          this.logger.error('Unix socket server error', error);
          reject(error);
        });
      } catch (error) {
        this.logger.error('Failed to start Unix socket server', error);
        reject(error);
      }
    });
  }
  
  /**
   * Handle a request
   */
  async _handleRequest(request) {
    try {
      const { operation, params } = request;
      
      // Check if operation is supported
      if (!operation || !this.requestHandlers[operation]) {
        return {
          error: true,
          message: `Unsupported operation: ${operation}`
        };
      }
      
      // Call the appropriate handler
      const result = await this.requestHandlers[operation](params || {});
      
      return {
        operation,
        result
      };
    } catch (error) {
      this.logger.error(`Error handling request: ${error.message}`, error);
      
      return {
        error: true,
        message: error.message
      };
    }
  }
  
  // Entity handlers
  
  async _handleStoreEntity(params) {
    const { entity, context } = params;
    
    if (!entity) {
      throw new Error('Entity is required');
    }
    
    return await this.storageManager.storeEntity(entity, context);
  }
  
  async _handleGetEntity(params) {
    const { id, context } = params;
    
    if (!id) {
      throw new Error('Entity ID is required');
    }
    
    return await this.storageManager.getEntity(id, context);
  }
  
  async _handleUpdateEntity(params) {
    const { id, updates, context } = params;
    
    if (!id) {
      throw new Error('Entity ID is required');
    }
    
    if (!updates) {
      throw new Error('Updates are required');
    }
    
    return await this.storageManager.updateEntity(id, updates, context);
  }
  
  async _handleDeleteEntity(params) {
    const { id, context } = params;
    
    if (!id) {
      throw new Error('Entity ID is required');
    }
    
    return await this.storageManager.deleteEntity(id, context);
  }
  
  async _handleListEntities(params) {
    const { type, context, limit, offset } = params;
    
    return await this.storageManager.listEntities(type, context, limit, offset);
  }
  
  // Relationship handlers
  
  async _handleCreateRelationship(params) {
    const { relationship } = params;
    
    if (!relationship) {
      throw new Error('Relationship is required');
    }
    
    return await this.knowledgeGraph.createRelationship(relationship);
  }
  
  async _handleGetRelationship(params) {
    const { id } = params;
    
    if (!id) {
      throw new Error('Relationship ID is required');
    }
    
    return await this.knowledgeGraph.getRelationship(id);
  }
  
  async _handleUpdateRelationship(params) {
    const { id, updates } = params;
    
    if (!id) {
      throw new Error('Relationship ID is required');
    }
    
    if (!updates) {
      throw new Error('Updates are required');
    }
    
    return await this.knowledgeGraph.updateRelationship(id, updates);
  }
  
  async _handleDeleteRelationship(params) {
    const { id } = params;
    
    if (!id) {
      throw new Error('Relationship ID is required');
    }
    
    return await this.knowledgeGraph.deleteRelationship(id);
  }
  
  async _handleListRelationships(params) {
    const { entityId, type, direction, limit, offset } = params;
    
    return await this.knowledgeGraph.listRelationships(entityId, type, direction, limit, offset);
  }
  
  // Query handlers
  
  async _handleSearchByText(params) {
    const { query, options } = params;
    
    if (!query) {
      throw new Error('Query is required');
    }
    
    return await this.queryEngine.searchByText(query, options);
  }
  
  async _handleSearchByVector(params) {
    const { vector, options } = params;
    
    if (!vector) {
      throw new Error('Vector is required');
    }
    
    return await this.queryEngine.searchByVector(vector, options);
  }
  
  async _handleSearchByMetadata(params) {
    const { metadata, options } = params;
    
    if (!metadata) {
      throw new Error('Metadata is required');
    }
    
    return await this.queryEngine.searchByMetadata(metadata, options);
  }
  
  async _handleTraverseGraph(params) {
    const { startEntityId, relationshipTypes, maxDepth, direction } = params;
    
    if (!startEntityId) {
      throw new Error('Start entity ID is required');
    }
    
    return await this.knowledgeGraph.traverseGraph(startEntityId, relationshipTypes, maxDepth, direction);
  }
  
  // Agent handlers
  
  async _handleFindEntitiesByAgentId(params) {
    const { agentId, type, limit, offset } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    return await this.storageManager.findEntitiesByAgentId(agentId, type, limit, offset);
  }
  
  async _handleGetAgentMemory(params) {
    const { agentId, memoryId } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!memoryId) {
      throw new Error('Memory ID is required');
    }
    
    return await this.storageManager.getAgentMemory(agentId, memoryId);
  }
  
  async _handleStoreAgentMemory(params) {
    const { agentId, memory } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!memory) {
      throw new Error('Memory is required');
    }
    
    return await this.storageManager.storeAgentMemory(agentId, memory);
  }
}

// If this file is run directly, start the server
if (require.main === module) {
  const server = new MemoryServer();
  
  server.start()
    .catch(error => {
      console.error('Failed to start memory server:', error);
      process.exit(1);
    });
  
  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('Shutting down memory server...');
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Shutting down memory server...');
    await server.stop();
    process.exit(0);
  });
}

module.exports = MemoryServer;