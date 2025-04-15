/**
 * MCP Memory Module - Storage Manager
 * 
 * Handles file operations, atomic writes, and maintains indices
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class StorageManager {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.errorHandler = options.errorHandler;
    
    // Base storage path
    this.basePath = options.basePath || path.join(process.env.HOME, 'Library/Application Support/MCP/memory');
    
    // Storage directories
    this.directories = {
      agents: path.join(this.basePath, 'agents'),
      shared: path.join(this.basePath, 'shared'),
      projects: path.join(this.basePath, 'projects'),
      templates: path.join(this.basePath, 'templates'),
      index: path.join(this.basePath, 'index'),
      relations: path.join(this.basePath, 'relations'),
      temp: path.join(this.basePath, 'temp')
    };
    
    // Indices
    this.indices = {
      text: new Map(),
      vector: new Map(),
      metadata: new Map(),
      agentId: new Map()
    };
    
    // Entity cache
    this.entityCache = new Map();
    this.maxCacheSize = options.maxCacheSize || 1000;
    
    // File locks
    this.fileLocks = new Map();
  }
  
  /**
   * Initialize the storage manager
   */
  async initialize() {
    try {
      // Create directories if they don't exist
      for (const dir of Object.values(this.directories)) {
        await fs.mkdir(dir, { recursive: true });
      }
      
      // Load indices
      await this._loadIndices();
      
      this.logger.info('Storage manager initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize storage manager', error);
      throw error;
    }
  }
  
  /**
   * Load indices from disk
   */
  async _loadIndices() {
    try {
      // Load text index
      const textIndexPath = path.join(this.directories.index, 'text-index.json');
      try {
        const textIndexData = await fs.readFile(textIndexPath, 'utf8');
        const textIndex = JSON.parse(textIndexData);
        
        for (const [term, entities] of Object.entries(textIndex)) {
          this.indices.text.set(term, new Set(entities));
        }
        
        this.logger.debug(`Loaded ${this.indices.text.size} terms in text index`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Load metadata index
      const metadataIndexPath = path.join(this.directories.index, 'metadata-index.json');
      try {
        const metadataIndexData = await fs.readFile(metadataIndexPath, 'utf8');
        const metadataIndex = JSON.parse(metadataIndexData);
        
        for (const [key, values] of Object.entries(metadataIndex)) {
          const valueMap = new Map();
          
          for (const [value, entities] of Object.entries(values)) {
            valueMap.set(value, new Set(entities));
          }
          
          this.indices.metadata.set(key, valueMap);
        }
        
        this.logger.debug(`Loaded ${this.indices.metadata.size} keys in metadata index`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Load agent ID index
      const agentIdIndexPath = path.join(this.directories.index, 'agent-id-index.json');
      try {
        const agentIdIndexData = await fs.readFile(agentIdIndexPath, 'utf8');
        const agentIdIndex = JSON.parse(agentIdIndexData);
        
        for (const [agentId, entities] of Object.entries(agentIdIndex)) {
          this.indices.agentId.set(agentId, new Set(entities));
        }
        
        this.logger.debug(`Loaded ${this.indices.agentId.size} agents in agent ID index`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Load vector index (if enabled)
      // Note: Vector indices are typically handled by specialized libraries
      // This is a simplified implementation
      
      this.logger.info('Indices loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load indices', error);
      throw error;
    }
  }
  
  /**
   * Save indices to disk
   */
  async _saveIndices() {
    try {
      // Save text index
      const textIndexPath = path.join(this.directories.index, 'text-index.json');
      const textIndex = {};
      
      for (const [term, entities] of this.indices.text.entries()) {
        textIndex[
                // Save text index
      const textIndexPath = path.join(this.directories.index, 'text-index.json');
      const textIndex = {};
      
      for (const [term, entities] of this.indices.text.entries()) {
        textIndex[term] = Array.from(entities);
      }
      
      await fs.writeFile(textIndexPath, JSON.stringify(textIndex, null, 2));
      
      // Save metadata index
      const metadataIndexPath = path.join(this.directories.index, 'metadata-index.json');
      const metadataIndex = {};
      
      for (const [key, valueMap] of this.indices.metadata.entries()) {
        metadataIndex[key] = {};
        
        for (const [value, entities] of valueMap.entries()) {
          metadataIndex[key][value] = Array.from(entities);
        }
      }
      
      await fs.writeFile(metadataIndexPath, JSON.stringify(metadataIndex, null, 2));
      
      // Save agent ID index
      const agentIdIndexPath = path.join(this.directories.index, 'agent-id-index.json');
      const agentIdIndex = {};
      
      for (const [agentId, entities] of this.indices.agentId.entries()) {
        agentIdIndex[agentId] = Array.from(entities);
      }
      
      await fs.writeFile(agentIdIndexPath, JSON.stringify(agentIdIndex, null, 2));
      
      // Save vector index (if implemented)
      
      this.logger.info('Indices saved successfully');
    } catch (error) {
      this.logger.error('Failed to save indices', error);
      throw error;
    }
  }
  
  /**
   * Get the storage path for an entity
   */
  _getEntityPath(entity, context) {
    let storageDir;
    
    if (context === 'agent' && entity.agentId) {
      // Store in agent directory
      storageDir = path.join(this.directories.agents, entity.agentId);
    } else if (context === 'project' && entity.projectId) {
      // Store in project directory
      storageDir = path.join(this.directories.projects, entity.projectId);
    } else if (context === 'template' && entity.templateId) {
      // Store in template directory
      storageDir = path.join(this.directories.templates, entity.templateId);
    } else if (context === 'shared') {
      // Store in shared directory
      storageDir = this.directories.shared;
    } else {
      // Default to temp directory
      storageDir = this.directories.temp;
    }
    
    // Create a filename based on entity ID
    const filename = `${entity.id}.json`;
    
    return {
      directory: storageDir,
      path: path.join(storageDir, filename)
    };
  }
  
  /**
   * Store an entity
   */
  async storeEntity(entity, context = 'shared') {
    try {
      // Validate entity
      if (!entity.id) {
        entity.id = `entity_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      }
      
      if (!entity.type) {
        throw new Error('Entity must have a type');
      }
      
      // Add metadata
      entity.created = entity.created || new Date().toISOString();
      entity.updated = new Date().toISOString();
      
      // Get storage path
      const { directory, path: entityPath } = this._getEntityPath(entity, context);
      
      // Create directory if it doesn't exist
      await fs.mkdir(directory, { recursive: true });
      
      // Acquire lock
      await this._acquireLock(entityPath);
      
      try {
        // Write entity to file
        await fs.writeFile(entityPath, JSON.stringify(entity, null, 2));
        
        // Update indices
        await this._indexEntity(entity);
        
        // Update cache
        this._cacheEntity(entity);
        
        this.logger.debug(`Stored entity: ${entity.id}`);
        
        return entity;
      } finally {
        // Release lock
        this._releaseLock(entityPath);
      }
    } catch (error) {
      this.logger.error(`Failed to store entity: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Get an entity
   */
  async getEntity(id, context = null) {
    try {
      // Check cache first
      if (this.entityCache.has(id)) {
        return this.entityCache.get(id);
      }
      
      // If context is not provided, search in all directories
      if (!context) {
        // Try to find entity in any context
        for (const ctx of ['agent', 'project', 'template', 'shared']) {
          try {
            const entity = await this._findEntityInContext(id, ctx);
            if (entity) {
              return entity;
            }
          } catch (error) {
            // Ignore errors and continue searching
          }
        }
        
        throw new Error(`Entity not found: ${id}`);
      }
      
      // Search in specific context
      return await this._findEntityInContext(id, context);
    } catch (error) {
      this.logger.error(`Failed to get entity: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Find an entity in a specific context
   */
  async _findEntityInContext(id, context) {
    // For agent context, we need to search in all agent directories
    if (context === 'agent') {
      try {
        const agentDirs = await fs.readdir(this.directories.agents);
        
        for (const agentId of agentDirs) {
          const entityPath = path.join(this.directories.agents, agentId, `${id}.json`);
          
          try {
            const entity = await this._readEntityFile(entityPath);
            if (entity) {
              return entity;
            }
          } catch (error) {
            // Ignore errors and continue searching
          }
        }
      } catch (error) {
        // Ignore errors and continue
      }
    } else if (context === 'project') {
      // Search in all project directories
      try {
        const projectDirs = await fs.readdir(this.directories.projects);
        
        for (const projectId of projectDirs) {
          const entityPath = path.join(this.directories.projects, projectId, `${id}.json`);
          
          try {
            const entity = await this._readEntityFile(entityPath);
            if (entity) {
              return entity;
            }
          } catch (error) {
            // Ignore errors and continue searching
          }
        }
      } catch (error) {
        // Ignore errors and continue
      }
    } else if (context === 'template') {
      // Search in all template directories
      try {
        const templateDirs = await fs.readdir(this.directories.templates);
        
        for (const templateId of templateDirs) {
          const entityPath = path.join(this.directories.templates, templateId, `${id}.json`);
          
          try {
            const entity = await this._readEntityFile(entityPath);
            if (entity) {
              return entity;
            }
          } catch (error) {
            // Ignore errors and continue searching
          }
        }
      } catch (error) {
        // Ignore errors and continue
      }
    } else if (context === 'shared') {
      // Search in shared directory
      const entityPath = path.join(this.directories.shared, `${id}.json`);
      
      try {
        const entity = await this._readEntityFile(entityPath);
        if (entity) {
          return entity;
        }
      } catch (error) {
        // Ignore errors and continue
      }
    }
    
    throw new Error(`Entity not found: ${id}`);
  }
  
  /**
   * Read an entity file
   */
  async _readEntityFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const entity = JSON.parse(data);
      
      // Update cache
      this._cacheEntity(entity);
      
      return entity;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      
      throw error;
    }
  }
  
  /**
   * Update an entity
   */
  async updateEntity(id, updates, context = null) {
    try {
      // Get existing entity
      const entity = await this.getEntity(id, context);
      
      if (!entity) {
        throw new Error(`Entity not found: ${id}`);
      }
      
      // Apply updates
      const updatedEntity = {
        ...entity,
        ...updates,
        id: entity.id, // Ensure ID doesn't change
        type: entity.type, // Ensure type doesn't change
        created: entity.created, // Preserve creation timestamp
        updated: new Date().toISOString() // Update timestamp
      };
      
      // Get storage path
      const { directory, path: entityPath } = this._getEntityPath(updatedEntity, context || this._getEntityContext(entity));
      
      // Acquire lock
      await this._acquireLock(entityPath);
      
      try {
        // Write updated entity to file
        await fs.writeFile(entityPath, JSON.stringify(updatedEntity, null, 2));
        
        // Update indices
        await this._updateEntityIndices(entity, updatedEntity);
        
        // Update cache
        this._cacheEntity(updatedEntity);
        
        this.logger.debug(`Updated entity: ${id}`);
        
        return updatedEntity;
      } finally {
        // Release lock
        this._releaseLock(entityPath);
      }
    } catch (error) {
      this.logger.error(`Failed to update entity: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Delete an entity
   */
  async deleteEntity(id, context = null) {
    try {
      // Get existing entity
      const entity = await this.getEntity(id, context);
      
      if (!entity) {
        throw new Error(`Entity not found: ${id}`);
      }
      
      // Get storage path
      const { path: entityPath } = this._getEntityPath(entity, context || this._getEntityContext(entity));
      
      // Acquire lock
      await this._acquireLock(entityPath);
      
      try {
        // Remove entity from indices
        await this._removeEntityFromIndices(entity);
        
        // Remove from cache
        this.entityCache.delete(id);
        
        // Delete file
        await fs.unlink(entityPath);
        
        this.logger.debug(`Deleted entity: ${id}`);
        
        return true;
      } finally {
        // Release lock
        this._releaseLock(entityPath);
      }
    } catch (error) {
      this.logger.error(`Failed to delete entity: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * List entities
   */
  async listEntities(type = null, context = null, limit = 100, offset = 0) {
    try {
      const entities = [];
      
      // Determine directories to search
      let directories = [];
      
      if (context === 'agent') {
        // Get all agent directories
        const agentDirs = await fs.readdir(this.directories.agents);
        directories = agentDirs.map(agentId => path.join(this.directories.agents, agentId));
      } else if (context === 'project') {
        // Get all project directories
        const projectDirs = await fs.readdir(this.directories.projects);
        directories = projectDirs.map(projectId => path.join(this.directories.projects, projectId));
      } else if (context === 'template') {
        // Get all template directories
        const templateDirs = await fs.readdir(this.directories.templates);
        directories = templateDirs.map(templateId => path.join(this.directories.templates, templateId));
      } else if (context === 'shared') {
        // Just the shared directory
        directories = [this.directories.shared];
      } else {
        // All directories
        directories = [
          this.directories.shared,
          ...await this._getAllSubdirectories(this.directories.agents),
          ...await this._getAllSubdirectories(this.directories.projects),
          ...await this._getAllSubdirectories(this.directories.templates)
        ];
      }
      
      // Search in each directory
      for (const directory of directories) {
        try {
          const files = await fs.readdir(directory);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              try {
                const filePath = path.join(directory, file);
                const entity = await this._readEntityFile(filePath);
                
                // Filter by type if specified
                if (!type || entity.type === type) {
                  entities.push(entity);
                }
              } catch (error) {
                // Ignore errors and continue
              }
            }
          }
        } catch (error) {
          // Ignore errors and continue
        }
      }
      
      // Apply pagination
      const paginatedEntities = entities.slice(offset, offset + limit);
      
      return {
        entities: paginatedEntities,
        total: entities.length,
        limit,
        offset
      };
    } catch (error) {
      this.logger.error(`Failed to list entities: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Get all subdirectories
   */
  async _getAllSubdirectories(directory) {
    try {
      const subdirs = [];
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          subdirs.push(path.join(directory, entry.name));
        }
      }
      
      return subdirs;
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Get entity context
   */
  _getEntityContext(entity) {
    if (entity.agentId) {
      return 'agent';
    } else if (entity.projectId) {
      return 'project';
    } else if (entity.templateId) {
      return 'template';
    } else {
      return 'shared';
    }
  }
  
  /**
   * Index an entity
   */
  async _indexEntity(entity) {
    try {
      // Text index
      if (entity.content) {
        this._indexText(entity.id, entity.content);
      }
      
      if (entity.name) {
        this._indexText(entity.id, entity.name);
      }
      
      if (entity.description) {
        this._indexText(entity.id, entity.description);
      }
      
      // Metadata index
      if (entity.metadata) {
        this._indexMetadata(entity.id, entity.metadata);
      }
      
      if (entity.tags) {
        this._indexMetadata(entity.id, { tags: entity.tags });
      }
      
      // Agent ID index
      if (entity.agentId) {
        this._indexAgentId(entity.id, entity.agentId);
      }
      
      // Save indices
      await this._saveIndices();
    } catch (error) {
      this.logger.error(`Failed to index entity: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Update entity indices
   */
  async _updateEntityIndices(oldEntity, newEntity) {
    try {
      // Remove old entity from indices
      await this._removeEntityFromIndices(oldEntity);
      
      // Add new entity to indices
      await this._indexEntity(newEntity);
    } catch (error) {
      this.logger.error(`Failed to update entity indices: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Remove entity from indices
   */
  async _removeEntityFromIndices(entity) {
    try {
      const entityId = entity.id;
      
      // Remove from text index
      for (const entities of this.indices.text.values()) {
        entities.delete(entityId);
      }
      
      // Remove from metadata index
      for (const valueMap of this.indices.metadata.values()) {
        for (const entities of valueMap.values()) {
          entities.delete(entityId);
        }
      }
      
      // Remove from agent ID index
      if (entity.agentId && this.indices.agentId.has(entity.agentId)) {
        this.indices.agentId.get(entity.agentId).delete(entityId);
      }
      
      // Save indices
      await this._saveIndices();
    } catch (error) {
      this.logger.error(`Failed to remove entity from indices: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Index text
   */
  _indexText(entityId, text) {
    if (!text) return;
    
    // Tokenize text
    const tokens = this._tokenizeText(text);
    
    // Add to index
    for (const token of tokens) {
      if (!this.indices.text.has(token)) {
        this.indices.text.set(token, new Set());
      }
      
      this.indices.text.get(token).add(entityId);
    }
  }
  
  /**
   * Tokenize text
   */
  _tokenizeText(text) {
    // Simple tokenization: lowercase, remove punctuation, split by whitespace
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
  }
  
  /**
   * Index metadata
   */
  _indexMetadata(entityId, metadata) {
    if (!metadata || typeof metadata !== 'object') return;
    
    for (const [key, value] of Object.entries(metadata)) {
      if (value === undefined || value === null) continue;
      
      // Handle arrays
      if (Array.isArray(value)) {
        for (const item of value) {
          this._indexMetadataValue(entityId, key, item);
        }
      } else {
        this._indexMetadataValue(entityId, key, value);
      }
    }
  }
  
  /**
   * Index metadata value
   */
  _indexMetadataValue(entityId, key, value) {
    // Convert value to string
    const stringValue = String(value);
    
    // Add to index
    if (!this.indices.metadata.has(key)) {
      this.indices.metadata.set(key, new Map());
    }
    
    const valueMap = this.indices.metadata.get(key);
    
    if (!valueMap.has(stringValue)) {
      valueMap.set(stringValue, new Set());
    }
    
    valueMap.get(stringValue).add(entityId);
  }
  
  /**
   * Index agent ID
   */
  _indexAgentId(entityId, agentId) {
    if (!agentId) return;
    
    // Add to index
    if (!this.indices.agentId.has(agentId)) {
      this.indices.agentId.set(agentId, new Set());
    }
    
    this.indices.agentId.get(agentId).add(entityId);
  }
  
  /**
   * Cache entity
   */
  _cacheEntity(entity) {
    // Add to cache
    this.entityCache.set(entity.id, entity);
    
    // Trim cache if it exceeds the maximum size
    if (this.entityCache.size > this.maxCacheSize) {
      // Remove oldest entries
      const entriesToRemove = this.entityCache.size - this.maxCacheSize;
      const keys = Array.from(this.entityCache.keys()).slice(0, entriesToRemove);
      
      for (const key of keys) {
        this.entityCache.delete(key);
      }
    }
  }
  
  /**
   * Acquire a file lock
   */
  async _acquireLock(filePath) {
    // Simple implementation: wait until lock is available
    while (this.fileLocks.has(filePath)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Acquire lock
    this.fileLocks.set(filePath, Date.now());
  }
  
  /**
   * Release a file lock
   */
  _releaseLock(filePath) {
    this.fileLocks.delete(filePath);
  }
  
  /**
   * Find entities by agent ID
   */
  async findEntitiesByAgentId(agentId, type = null, limit = 100, offset = 0) {
    try {
      // Check if agent ID is indexed
      if (this.indices.agentId.has(agentId)) {
        const entityIds = Array.from(this.indices.agentId.get(agentId));
        const entities = [];
        
        // Get entities
        for (const entityId of entityIds) {
          try {
            const entity = await this.getEntity(entityId, 'agent');
            
            // Filter by type if specified
            if (!type || entity.type === type) {
              entities.push(entity);
            }
          } catch (error) {
            // Ignore errors and continue
          }
        }
        
        // Apply pagination
        const paginatedEntities = entities.slice(offset, offset + limit);
        
        return paginatedEntities;
      }
      
      // If not indexed, search in agent directory
      const agentDir = path.join(this.directories.agents, agentId);
      
      try {
        await fs.access(agentDir);
      } catch (error) {
        // Agent directory doesn't exist
        return [];
      }
      
      const files = await fs.readdir(agentDir);
      const entities = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(agentDir, file);
            const entity = await this._readEntityFile(filePath);
            
            // Filter by type if specified
            if (!type || entity.type === type) {
              entities.push(entity);
            }
          } catch (error) {
            // Ignore errors and continue
          }
        }
      }
      
      // Apply pagination
      const paginatedEntities = entities.slice(offset, offset + limit);
      
      return paginatedEntities;
    } catch (error) {
      this.logger.error(`Failed to find entities by agent ID: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Get agent memory
   */
  async getAgentMemory(agentId, memoryId) {
    try {
      // Get memory entity
      const memory = await this.getEntity(memoryId, 'agent');
      
      // Verify agent ID
      if (memory.agentId !== agentId) {
        throw new Error('Memory does not belong to the specified agent');
      }
      
      return memory;
    } catch (error) {
      this.logger.error(`Failed to get agent memory: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Store agent memory
   */
  async storeAgentMemory(agentId, memory) {
    try {
      // Ensure memory has required fields
      if (!memory.content) {
        throw new Error('Memory must have content');
      }
      
      // Create memory entity
      const memoryEntity = {
        id: memory.id || `memory_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        type: 'memory',
        agentId,
        content: memory.content,
        timestamp: memory.timestamp || new Date().toISOString(),
        tags: memory.tags || [],
        metadata: memory.metadata || {}
      };
      
      // Store entity
      return await this.storeEntity(memoryEntity, 'agent');
    } catch (error) {
      this.logger.error(`Failed to store agent memory: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = StorageManager;