/**
 * MCP Memory Module - Storage Manager
 * Reference Implementation
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class StorageManager {
  constructor(options = {}) {
    this.basePath = options.basePath || path.join(process.env.HOME, 'Library/Application Support/MCP/memory/data');
    this.entitiesPath = path.join(this.basePath, 'entities');
    this.relationsPath = path.join(this.basePath, 'relations');
    this.indicesPath = path.join(this.basePath, 'indices');
    this.tempPath = path.join(this.basePath, 'temp');
    
    this.logger = options.logger || console;
  }
  
  async initialize() {
    // Ensure directories exist
    await fs.mkdir(this.entitiesPath, { recursive: true });
    await fs.mkdir(this.relationsPath, { recursive: true });
    await fs.mkdir(this.indicesPath, { recursive: true });
    await fs.mkdir(this.tempPath, { recursive: true });
    
    this.logger.info('Storage manager initialized');
    return true;
  }
  
  async storeEntity(entity) {
    // Generate ID if not provided
    if (!entity.id) {
      entity.id = `entity_${crypto.randomUUID()}`;
    }
    
    // Set timestamps
    if (!entity.created) entity.created = new Date().toISOString();
    entity.updated = new Date().toISOString();
    
    // Write entity to file
    const filePath = path.join(this.entitiesPath, `${entity.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(entity, null, 2));
    
    return entity;
  }
  
  async getEntity(id) {
    try {
      const filePath = path.join(this.entitiesPath, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
  
  async deleteEntity(id) {
    try {
      const filePath = path.join(this.entitiesPath, `${id}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }
}

module.exports = StorageManager;