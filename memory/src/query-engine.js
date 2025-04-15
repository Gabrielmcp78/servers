/**
 * MCP Memory Module - Query Engine
 * 
 * Processes search queries, handles semantic similarity searches, and combines results from different sources
 */

class QueryEngine {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.errorHandler = options.errorHandler;
    this.storageManager = options.storageManager;
    this.knowledgeGraph = options.knowledgeGraph;
    
    if (!this.storageManager) {
      throw new Error('Storage manager is required');
    }
    
    if (!this.knowledgeGraph) {
      throw new Error('Knowledge graph is required');
    }
    
    // Vectorization options
    this.vectorizationOptions = options.vectorization || {
      model: 'text-embedding-ada-002',
      dimensions: 1536,
      batchSize: 10
    };
  }
  
  /**
   * Initialize the query engine
   */
  async initialize() {
    try {
      this.logger.info('Query engine initialized');
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize query engine', error);
      throw error;
    }
  }
  
  /**
   * Search by text
   */
  async searchByText(query, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        threshold = 0.0,
        context = null,
        type = null,
        agentId = null
      } = options;
      
      // Tokenize query
      const queryTokens = this._tokenizeText(query);
      
      // Get matching entities from text index
      const matchingEntityIds = new Map(); // entityId -> score
      
      for (const token of queryTokens) {
        if (this.storageManager.indices.text.has(token)) {
          const entities = this.storageManager.indices.text.get(token);
          
          for (const entityId of entities) {
            // Increment score for each matching token
            matchingEntityIds.set(
              entityId,
              (matchingEntityIds.get(entityId) || 0) + 1
            );
          }
        }
      }
      
      // Convert to array and sort by score
      let results = Array.from(matchingEntityIds.entries())
        .map(([entityId, score]) => ({
          entityId,
          score: score / queryTokens.length // Normalize score
        }))
        .filter(item => item.score >= threshold)
        .sort((a, b) => b.score - a.score);
      
      // Apply additional filters
      if (agentId) {
        results = results.filter(item => {
          const entity = this.storageManager.entityCache.get(item.entityId);
          return entity && entity.agentId === agentId;
        });
      }
      
      if (type) {
        results = results.filter(item => {
          const entity = this.storageManager.entityCache.get(item.entityId);
          return entity && entity.type === type;
        });
      }
      
      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit);
      
      // Get full entities
      const entities = await Promise.all(
        paginatedResults.map(async item => {
          try {
            const entity = await this.storageManager.getEntity(item.entityId, context);
            return {
              entity,
              score: item.score
            };
          } catch (error) {
            return null;
          }
        })
      );
      
      // Filter out nulls
      const validEntities = entities.filter(item => item !== null);
      
      return {
        query,
        results: validEntities,
        total: results.length,
        limit,
        offset
      };
    } catch (error) {
      this.logger.error(`Failed to search by text: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Search by vector
   */
  async searchByVector(vector, options = {}) {
    try {
      const {
        limit = 10,
        threshold = 0.7,
        context = null,
        type = null,
        agentId = null
      } = options;
      
      // This is a placeholder for vector search
      // In a real implementation, you would use a vector database or library
      this.logger.warn('Vector search is not fully implemented');
      
      // Return empty results for now
      return {
        results: [],
        total: 0,
        limit
      };
    } catch (error) {
      this.logger.error(`Failed to search by vector: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Search by metadata
   */
  async searchByMetadata(metadata, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        context = null,
        type = null,
        agentId = null,
        matchAll = true
      } = options;
      
      // Get matching entities from metadata index
      const matchingSets = [];
      
      for (const [key, value] of Object.entries(metadata)) {
        if (this.storageManager.indices.metadata.has(key)) {
          const valueMap = this.storageManager.indices.metadata.get(key);
          
          if (valueMap.has(String(value))) {
            matchingSets.push(valueMap.get(String(value)));
          }
        }
      }
      
      if (matchingSets.length === 0) {
        return {
          results: [],
          total: 0,
          limit,
          offset
        };
      }
      
      // Combine sets based on matchAll option
      let matchingEntityIds;
      
      if (matchAll) {
        // Intersection of all sets
        matchingEntityIds = new Set(matchingSets[0]);
        
        for (let i = 1; i < matchingSets.length; i++) {
          matchingEntityIds = new Set(
            Array.from(matchingEntityIds).filter(id => matchingSets[i].has(id))
          );
        }
      } else {
        // Union of all sets
        matchingEntityIds = new Set();
        
        for (const set of matchingSets) {
          for (const id of set) {
            matchingEntityIds.add(id);
          }
        }
      }
      
      // Convert to array
      let results = Array.from(matchingEntityIds);
      
      // Apply additional filters
      if (agentId) {
        results = results.filter(entityId => {
          const entity = this.storageManager.entityCache.get(entityId);
          return entity && entity.agentId === agentId;
        });
      }
      
      if (type) {
        results = results.filter(entityId => {
          const entity = this.storageManager.entityCache.get(entityId);
          return entity && entity.type === type;
        });
      }
      
      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit);
      
      // Get full entities
      const entities = await Promise.all(
        paginatedResults.map(async entityId => {
          try {
            const entity = await this.storageManager.getEntity(entityId, context);
            return { entity };
          } catch (error) {
            return null;
          }
        })
      );
      
      // Filter out nulls
      const validEntities = entities.filter(item => item !== null);
      
      return {
        results: validEntities,
        total: results.length,
        limit,
        offset
      };
    } catch (error) {
      this.logger.error(`Failed to search by metadata: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Combined search
   */
  async search(query, options = {}) {
    try {
      const {
        limit = 10,
        offset = 0,
        context = null,
        type = null,
        agentId = null,
        searchVector = false,
        searchMetadata = true,
        weights = {
          text: 0.6,
          vector: 0.3,
          metadata: 0.1
        }
      } = options;
      
      // Perform text search
      const textResults = await this.searchByText(query, {
        limit: limit * 2, // Get more results to combine
        context,
        type,
        agentId
      });
      
      // Create a map of entity ID to result
      const resultMap = new Map();
      
      // Add text search results
      for (const item of textResults.results) {
        resultMap.set(item.entity.id, {
          entity: item.entity,
          scores: {
            text: item.score,
            vector: 0,
            metadata: 0
          }
        });
      }
      
      // Perform vector search if enabled
      if (searchVector) {
        // This would require vectorizing the query
        // For now, we'll skip this step
      }
      
      // Perform metadata search if enabled
      if (searchMetadata && typeof query === 'object') {
        const metadataResults = await this.searchByMetadata(query, {
          limit: limit * 2,
          context,
          type,
          agentId
        });
        
        // Add metadata search results
        for (const item of metadataResults.results) {
          if (resultMap.has(item.entity.id)) {
            // Update existing result
            resultMap.get(item.entity.id).scores.metadata = 1.0;
          } else {
            // Add new result
            resultMap.set(item.entity.id, {
              entity: item.entity,
              scores: {
                text: 0,
                vector: 0,
                metadata: 1.0
              }
            });
          }
        }
      }
      
      // Calculate combined scores
      const results = Array.from(resultMap.values()).map(item => {
        const combinedScore = 
          (item.scores.text * weights.text) +
          (item.scores.vector * weights.vector) +
          (item.scores.metadata * weights.metadata);
        
        return {
          entity: item.entity,
          score: combinedScore,
          scores: item.scores
        };
      });
      
      // Sort by combined score
      results.sort((a, b) => b.score - a.score);
      
      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit);
      
      return {
        query,
        results: paginatedResults,
        total: results.length,
        limit,
        offset
      };
    } catch (error) {
      this.logger.error(`Failed to perform combined search: ${error.message}`, error);
      throw error;
    }
  }
  
  /**
   * Tokenize text
   */
  _tokenizeText(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    // Simple tokenization: lowercase, remove punctuation, split by whitespace
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
  }
  
  /**
   * Semantic search
   */
  async semanticSearch(query, options = {}) {
    try {
      const {
        limit = 10,
        threshold = 0.7,
        context = null,
        type = null,
        agentId = null,
        includeRelated = false,
        maxRelatedDepth = 1
      } = options;
      
      // Perform combined search
      const searchResults = await this.search(query, {
        limit,
        context,
        type,
        agentId,
        searchVector: true
      });
      
      // If requested, include related entities
      if (includeRelated && searchResults.results.length > 0) {
        // Get top result
        const topResult = searchResults.results[0];
        
        // Find related entities
        const relatedResults = await this.knowledgeGraph.findRelatedEntities(
          topResult.entity.id,
          {
            maxDepth: maxRelatedDepth,
            limit: Math.max(5, limit - searchResults.results.length)
          }
        );
        
        // Add related entities to results
        for (const relatedEntity of relatedResults.entities) {
          // Check if already in results
          if (!searchResults.results.some(item => item.entity.id === relatedEntity.id)) {
            searchResults.results.push({
              entity: relatedEntity,
              score: 0.5, // Lower score for related entities
              related: true
            });
          }
        }
        
        // Re-sort results
        searchResults.results.sort((a, b) => b.score - a.score);
        
        // Apply limit
        searchResults.results = searchResults.results.slice(0, limit);
      }
      
      return searchResults;
    } catch (error) {
      this.logger.error(`Failed to perform semantic search: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = QueryEngine;
