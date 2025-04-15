/**
 * MCP Communications Module - A2A Protocol
 * Reference Implementation
 */

const EventEmitter = require('events');

class A2AProtocol extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.agents = new Map();
    this.functions = new Map();
    this.logger = options.logger || console;
  }
  
  registerAgent(agent) {
    if (!agent.id) throw new Error('Agent must have an id');
    if (!agent.name) throw new Error('Agent must have a name');
    
    this.agents.set(agent.id, agent);
    this.logger.info(`Agent registered: ${agent.name} (${agent.id})`);
    
    this.emit('agent:registered', agent);
    return agent;
  }
  
  unregisterAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    this.agents.delete(agentId);
    this.logger.info(`Agent unregistered: ${agent.name} (${agent.id})`);
    
    this.emit('agent:unregistered', agent);
    return true;
  }
  
  registerFunction(func) {
    if (!func.name) throw new Error('Function must have a name');
    if (typeof func.handler !== 'function') throw new Error('Function must have a handler');
    
    this.functions.set(func.name, func);
    this.logger.info(`Function registered: ${func.name}`);
    
    return func;
  }
  
  async sendMessage(message) {
    // Validate message
    if (!message.sender) throw new Error('Message must have a sender');
    if (!message.recipients || !Array.isArray(message.recipients)) {
      throw new Error('Message must have recipients array');
    }
    if (!message.content) throw new Error('Message must have content');
    
    // Generate ID if not provided
    if (!message.id) {
      message.id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    }
    
    // Set timestamp if not provided
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }
    
    this.logger.info(`Sending message: ${message.id}`);
    this.emit('message:sent', message);
    
    // Deliver to recipients
    const deliveryResults = [];
    
    for (const recipientId of message.recipients) {
      const agent = this.agents.get(recipientId);
      
      if (!agent) {
        deliveryResults.push({
          recipientId,
          delivered: false,
          reason: 'Agent not found'
        });
        continue;
      }
      
      if (!agent.connection) {
        deliveryResults.push({
          recipientId,
          delivered: false,
          reason: 'Agent not connected'
        });
        continue;
      }
      
      try {
        if (typeof agent.connection.deliver === 'function') {
          await agent.connection.deliver(message);
          
          deliveryResults.push({
            recipientId,
            delivered: true
          });
          
          this.emit('message:delivered', message, agent);
        } else {
          deliveryResults.push({
            recipientId,
            delivered: false,
            reason: 'No delivery method'
          });
        }
      } catch (error) {
        deliveryResults.push({
          recipientId,
          delivered: false,
          reason: error.message
        });
      }
    }
    
    return {
      messageId: message.id,
      deliveryResults
    };
  }
}

module.exports = A2AProtocol;'/Users/gabrielmcp/Library/Application Support/MCP'