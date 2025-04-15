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
    }
  }
  
  /**
   * List relationships
   */
  async listRelationships(entityId, type = null, direction = 'both', limit = 100, offset = 0) {
    try {
      const relationships = [];
      
      if (direction === 'outgoing' || direction === 'both') {
        // Get relationships where entity is the source
        if (this.indices.source.has(entityId)) {
          const relationshipIds = Array.from(this.indices.source.get(entityId));
          
          for (const id of relationshipIds) {
            try {
              const relationship = await this.getRelationship(id);
              
              // Filter by type if specified
              if (!type || relationship.type === type) {
                relationships.push(relationship);
              }
            } catch (error) {
              // Ignore errors and continue
            }
          }
        }
      }
      
      if (direction === 'incoming' || direction === 'both') {
        // Get relationships where entity is the target
        if (this.indices.target.has(entityId)) {
          const relationshipIds = Array.from(this.indices.target.get(entityId));
          
          for (const id of relationshipIds) {
            try {
              const relationship = await this.getRelationship(id);
              
              // Filter by type if specified
              if (!type || relationship.type === type) {
                relationships.push(relationship);
              }
            } catch (error) {
              // Ignore errors and continue
            }
          }
        }
      }
      
      // Apply pagination
      const paginatedRelationships = relationships.slice(offset, offset + limit);
      
      return {
        relationships: paginatedRelationships,
        total: relationships.length,
        limit,
        offset
      };
    } catch (error) {
      this.logger.error(`Failed to list relationships: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Traverse the graph
   */
  async traverseGraph(startEntityId, relationshipTypes = null, maxDepth = 3, direction = 'both') {
    try {
      // Validate start entity
      const startEntity = await this.storageManager.getEntity(startEntityId);
      
      if (!startEntity) {
        throw new Error(`Start entity not found: ${startEntityId}`);
      }
      
      // Initialize traversal
      const visited = new Set();
      const result = {
        entities: [startEntity],
        relationships: [],
        paths: {}
      };
      
      // Add start entity to visited set
      visited.add(startEntityId);
      
      // Initialize paths
      result.paths[startEntityId] = {
        distance: 0,
        path: []
      };
      
      // Perform breadth-first traversal
      await this._traverseBFS(
        startEntityId,
        relationshipTypes,
        maxDepth,
        direction,
        visited,
        result
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to traverse graph: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Breadth-first traversal
   */
  async _traverseBFS(startEntityId, relationshipTypes, maxDepth, direction, visited, result) {
    // Queue for BFS
    const queue = [{
      entityId: startEntityId,
      depth: 0
    }];
    
    while (queue.length > 0) {
      const { entityId, depth } = queue.shift();
      
      // Stop if we've reached the maximum depth
      if (depth >= maxDepth) {
        continue;
      }
      
      // Get relationships for this entity
      const { relationships } = await this.listRelationships(
        entityId,
        null, // Get all types, we'll filter later
        direction,
        1000, // Get a large number to avoid pagination
        0
      );
      
      for (const relationship of relationships) {
        // Filter by relationship type if specified
        if (relationshipTypes && !relationshipTypes.includes(relationship.type)) {
          continue;
        }
        
        // Add relationship to result
        if (!result.relationships.some(r => r.id === relationship.id)) {
          result.relationships.push(relationship);
        }
        
        // Determine the connected entity
        const connectedEntityId = relationship.sourceId === entityId
          ? relationship.targetId
          : relationship.sourceId;
        
        // Skip if already visited
        if (visited.has(connectedEntityId)) {
          continue;
        }
        
        // Mark as visited
        visited.add(connectedEntityId);
        
        // Get the connected entity
        try {
          const connectedEntity = await this.storageManager.getEntity(connectedEntityId);
          
          if (connectedEntity) {
            // Add entity to result
            result.entities.push(connectedEntity);
            
            // Update path information
            result.paths[connectedEntityId] = {
              distance: depth + 1,
              path: [
                ...result.paths[entityId].path,
                {
                  relationshipId: relationship.id,
                  relationshipType: relationship.type,
                  direction: relationship.sourceId === entityId ? 'outgoing' : 'incoming'
                }
              ]
            };
            
            // Add to queue for further traversal
            queue.push({
              entityId: connectedEntityId,
              depth: depth + 1
            });
          }
        } catch (error) {
          // Ignore errors and continue
          this.logger.warn(`Failed to get connected entity: ${connectedEntityId}`, error);
        }
      }
    }
  }
  
  /**
   * Index a relationship
   */
  _indexRelationship(relationship) {
    // Source index
    if (!this.indices.source.has(relationship.sourceId)) {
      this.indices.source.set(relationship.sourceId, new Set());
    }
    this.indices.source.get(relationship.sourceId).add(relationship.id);
    
    // Target index
    if (!this.indices.target.has(relationship.targetId)) {
      this.indices.target.set(relationship.targetId, new Set());
    }
    this.indices.target.get(relationship.targetId).add(relationship.id);
    
    // Type index
    if (!this.indices.type.has(relationship.type)) {
      this.indices.type.set(relationship.type, new Set());
    }
    this.indices.type.get(relationship.type).add(relationship.id);
  }
  
  /**
   * Remove a relationship from indices
   */
  _removeRelationshipFromIndices(relationship) {
    // Source index
    if (this.indices.source.has(relationship.sourceId)) {
      this.indices.source.get(relationship.sourceId).delete(relationship.id);
      
      // Remove empty sets
      if (this.indices.source.get(relationship.sourceId).size === 0) {
        this.indices.source.delete(relationship.sourceId);
      }
    }
    
    // Target index
    if (this.indices.target.has(relationship.targetId)) {
      this.indices.target.get(relationship.targetId).delete(relationship.id);
      
      // Remove empty sets
      if (this.indices.target.get(relationship.targetId).size === 0) {
        this.indices.target.delete(relationship.targetId);
      }
    }
    
    // Type index
    if (this.indices.type.has(relationship.type)) {
      this.indices.type.get(relationship.type).delete(relationship.id);
      
      // Remove empty sets
      if (this.indices.type.get(relationship.type).size === 0) {
        this.indices.type.delete(relationship.type);
      }
    }
  }
  
  /**
   * Cache a relationship
   */
  _cacheRelationship(relationship) {
    // Add to cache
    this.relationshipCache.set(relationship.id, relationship);
    
    // Trim cache if it exceeds the maximum size
    if (this.relationshipCache.size > this.maxCacheSize) {
      // Remove oldest entries
      const entriesToRemove = this.relationshipCache.size - this.maxCacheSize;
      const keys = Array.from(this.relationshipCache.keys()).slice(0, entriesToRemove);
      
      for (const key of keys) {
        this.relationshipCache.delete(key);
      }
    }
  }
  
  /**
   * Find related entities
   */
  async findRelatedEntities(entityId, options = {}) {
    try {
      const {
        relationshipTypes = null,
        maxDepth = 1,
        direction = 'both',
        limit = 10
      } = options;
      
      // Traverse graph
      const traversalResult = await this.traverseGraph(
        entityId,
        relationshipTypes,
        maxDepth,
        direction
      );
      
      // Sort entities by distance
      const sortedEntities = traversalResult.entities
        .filter(entity => entity.id !== entityId) // Exclude the start entity
        .sort((a, b) => {
          const distanceA = traversalResult.paths[a.id].distance;
          const distanceB = traversalResult.paths[b.id].distance;
          return distanceA - distanceB;
        })
        .slice(0, limit);
      
      return {
        entities: sortedEntities,
        paths: traversalResult.paths
      };
    } catch (error) {
      this.logger.error(`Failed to find related entities: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Find common connections
   */
  async findCommonConnections(entityIds, options = {}) {
    try {
      if (!Array.isArray(entityIds) || entityIds.length < 2) {
        throw new Error('At least two entity IDs are required');
      }
      
      const {
        relationshipTypes = null,
        maxDepth = 2,
        direction = 'both',
        limit = 10
      } = options;
      
      // Get traversal results for each entity
      const traversalResults = await Promise.all(
        entityIds.map(entityId => 
          this.traverseGraph(entityId, relationshipTypes, maxDepth, direction)
        )
      );
      
      // Find common entities
      const entitySets = traversalResults.map(result => 
        new Set(result.entities.map(entity => entity.id))
      );
      
      // Start with all entities from the first set
      let commonEntityIds = Array.from(entitySets[0]);
      
      // Intersect with each subsequent set
      for (let i = 1; i < entitySets.length; i++) {
        commonEntityIds = commonEntityIds.filter(id => entitySets[i].has(id));
      }
      
      // Remove the original entities
      commonEntityIds = commonEntityIds.filter(id => !entityIds.includes(id));
      
      // Get the common entities
      const commonEntities = await Promise.all(
        commonEntityIds.map(id => this.storageManager.getEntity(id))
      );
      
      // Sort by average distance
      const sortedEntities = commonEntities
        .map(entity => {
          // Calculate average distance
          const totalDistance = traversalResults.reduce((sum, result) => {
            return sum + (result.paths[entity.id]?.distance || 0);
          }, 0);
          
          const avgDistance = totalDistance / traversalResults.length;
          
          return {
            entity,
            avgDistance
          };
        })
        .sort((a, b) => a.avgDistance - b.avgDistance)
        .slice(0, limit)
        .map(item => item.entity);
      
      return sortedEntities;
    } catch (error) {
      this.logger.error(`Failed to find common connections: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = KnowledgeGraph;
