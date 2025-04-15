/**
 * MCP Memory Module - Knowledge Graph
 * 
 * Manages entity relationships, provides graph traversal operations, and handles inference
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class KnowledgeGraph {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.errorHandler = options.errorHandler;
    this.storageManager = options.storageManager;
    
    if (!this.storageManager) {
      throw new Error('Storage manager is required');
    }
    
    // Relationships directory
    this.relationsDir = options.relationsDir || path.join(
      process.env.HOME,
      'Library/Application Support/MCP/memory/relations'
    );
    
    // Relationship indices
    this.indices = {
      source: new Map(), // sourceId -> Set of relationship IDs
      target: new Map(), // targetId -> Set of relationship IDs
      type: new Map()    // type -> Set of relationship IDs
    };
    
    // Relationship cache
    this.relationshipCache = new Map();
    this.maxCacheSize = options.maxCacheSize || 1000;
  }
  
  /**
   * Initialize the knowledge graph
   */
  async initialize() {
    try {
      // Create relations directory if it doesn't exist
      await fs.mkdir(this.relationsDir, { recursive: true });
      
      // Load relationship indices
      await this._loadIndices();
      
      this.logger.info('Knowledge graph initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize knowledge graph', error);
      throw error;
    }
  }
  
  /**
   * Load relationship indices
   */
  async _loadIndices() {
    try {
      // Get all relationship files
      const files = await fs.readdir(this.relationsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.relationsDir, file);
            const data = await fs.readFile(filePath, 'utf8');
            const relationship = JSON.parse(data);
            
            // Add to indices
            this._indexRelationship(relationship);
            
            // Add to cache
            this._cacheRelationship(relationship);
          } catch (error) {
            this.logger.error(`Failed to load relationship file: ${file}`, error);
          }
        }
      }
      
      this.logger.debug(`Loaded ${this.relationshipCache.size} relationships`);
    } catch (error) {
      this.logger.error('Failed to load relationship indices', error);
      throw error;
    }
  }
  
  /**
   * Create a relationship
   */
  async createRelationship(relationship) {
    try {
      // Validate relationship
      if (!relationship.sourceId) {
        throw new Error('Relationship must have a source ID');
      }
      
      if (!relationship.targetId) {
        throw new Error('Relationship must have a target ID');
      }
      
      if (!relationship.type) {
        throw new Error('Relationship must have a type');
      }
      
      // Generate ID if not provided
      if (!relationship.id) {
        relationship.id = `rel_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      }
      
      // Add metadata
      relationship.created = relationship.created || new Date().toISOString();
      relationship.updated = new Date().toISOString();
      
      // Write relationship to file
      const filePath = path.join(this.relationsDir, `${relationship.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(relationship, null, 2));
      
      // Add to indices
      this._indexRelationship(relationship);
      
      // Add to cache
      this._cacheRelationship(relationship);
      
      this.logger.debug(`Created relationship: ${relationship.id}`);
      
      return relationship;
    } catch (error) {
      this.logger.error(`Failed to create relationship: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Get a relationship
   */
  async getRelationship(id) {
    try {
      // Check cache first
      if (this.relationshipCache.has(id)) {
        return this.relationshipCache.get(id);
      }
      
      // Read from file
      const filePath = path.join(this.relationsDir, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      const relationship = JSON.parse(data);
      
      // Add to cache
      this._cacheRelationship(relationship);
      
      return relationship;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Relationship not found: ${id}`);
      }
      
      this.logger.error(`Failed to get relationship: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Update a relationship
   */
  async updateRelationship(id, updates) {
    try {
      // Get existing relationship
      const relationship = await this.getRelationship(id);
      
      // Apply updates
      const updatedRelationship = {
        ...relationship,
        ...updates,
        id: relationship.id, // Ensure ID doesn't change
        sourceId: relationship.sourceId, // Ensure source ID doesn't change
        targetId: relationship.targetId, // Ensure target ID doesn't change
        type: updates.type || relationship.type, // Allow type to be updated
        created: relationship.created, // Preserve creation timestamp
        updated: new Date().toISOString() // Update timestamp
      };
      
      // Write updated relationship to file
      const filePath = path.join(this.relationsDir, `${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(updatedRelationship, null, 2));
      
      // Update indices
      this._removeRelationshipFromIndices(relationship);
      this._indexRelationship(updatedRelationship);
      
      // Update cache
      this._cacheRelationship(updatedRelationship);
      
      this.logger.debug(`Updated relationship: ${id}`);
      
      return updatedRelationship;
    } catch (error) {
      this.logger.error(`Failed to update relationship: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Delete a relationship
   */
  async deleteRelationship(id) {
    try {
      // Get existing relationship
      const relationship = await this.getRelationship(id);
      
      // Remove from indices
      this._removeRelationshipFromIndices(relationship);
      
      // Remove from cache
      this.relationshipCache.delete(id);
      
      // Delete file
      const filePath = path.join(this.relationsDir, `${id}.json`);
      await fs.unlink(filePath);
      
      this.logger.debug(`Deleted relationship: ${id}`);
      
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      
      this.logger.error(`Failed to delete relationship: ${error.message}`, error);
      throw error;