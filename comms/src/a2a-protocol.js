/**
 * A2A Protocol Implementation
 * Based on Google's Agent-to-Agent (A2A) protocol
 * https://google.github.io/A2A/
 */

const EventEmitter = require('events');
const a2aUtils = require('../../shared/a2a-utils');

class A2AProtocol extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = options.logger;
    this.errorHandler = options.errorHandler;
    
    // Agent registry
    this.agents = new Map();
    
    // Function registry
    this.functions = new Map();
    
    // Message history (optional, can be disabled)
    this.keepHistory = options.keepHistory !== false;
    this.messageHistory = new Map();
    this.maxHistoryPerAgent = options.maxHistoryPerAgent || 100;
  }
  
  /**
   * Register an agent with the protocol
   */
  registerAgent(agent) {
    if (!agent.id) throw new Error('Agent must have an id');
    if (!agent.name) throw new Error('Agent must have a name');
    
    // Set default role if not provided
    if (!agent.role) {
      agent.role = a2aUtils.AgentRole.ASSISTANT;
    }
    
    // Add connection info if provided
    if (agent.connection) {
      agent.connection.lastActive = new Date();
    }
    
    // Initialize message history for this agent if enabled
    if (this.keepHistory && !this.messageHistory.has(agent.id)) {
      this.messageHistory.set(agent.id, []);
    }
    
    // Register the agent
    this.agents.set(agent.id, agent);
    
    this.logger.info(`Agent registered: ${agent.name} (${agent.id})`);
    
    // Emit agent registered event
    this.emit('agent:registered', agent);
    
    return agent;
  }
  
  /**
   * Unregister an agent from the protocol
   */
  unregisterAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    // Remove the agent
    this.agents.delete(agentId);
    
    this.logger.info(`Agent unregistered: ${agent.name} (${agent.id})`);
    
    // Emit agent unregistered event
    this.emit('agent:unregistered', agent);
    
    return true;
  }
  
  /**
   * Get an agent by ID
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }
  
  /**
   * Get all registered agents
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }
  
  /**
   * Update agent connection status
   */
  updateAgentConnection(agentId, connection) {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    agent.connection = {
      ...connection,
      lastActive: new Date()
    };
    
    this.agents.set(agentId, agent);
    
    return true;
  }
  
  /**
   * Register a function that can be called by agents
   */
  registerFunction(func) {
    if (!func.name) throw new Error('Function must have a name');
    if (!func.description) throw new Error('Function must have a description');
    if (typeof func.handler !== 'function') throw new Error('Function must have a handler');
    
    this.functions.set(func.name, func);
    
    this.logger.info(`Function registered: ${func.name}`);
    
    return func;
  }
  
  /**
   * Unregister a function
   */
  unregisterFunction(functionName) {
    const func = this.functions.get(functionName);
    if (!func) return false;
    
    this.functions.delete(functionName);
    
    this.logger.info(`Function unregistered: ${functionName}`);
    
    return true;
  }
  
  /**
   * Get a function by name
   */
  getFunction(functionName) {
    return this.functions.get(functionName);
  }
  
  /**
   * Get all registered functions
   */
  getAllFunctions() {
    return Array.from(this.functions.values());
  }
  
  /**
   * Process an incoming message
   */
  async processMessage(message) {
    try {
      // Validate the message
      a2aUtils.validateMessage(message);
      
      // Store in history if enabled
      if (this.keepHistory) {
        this._addToHistory(message);
      }
      
      // Emit message received event
      this.emit('message:received', message);
      
      // Process based on message type
      switch (message.type) {
        case a2aUtils.MessageType.FUNCTION_CALL:
          return await this._processFunctionCall(message);
          
        case a2aUtils.MessageType.TEXT:
        case a2aUtils.MessageType.FUNCTION_RESPONSE:
        case a2aUtils.MessageType.ERROR:
        case a2aUtils.MessageType.SYSTEM:
          // For these message types, just route to recipients
          return await this._routeMessage(message);
          
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      this.logger.error('Error processing message', error);
      
      // Create error message
      const errorMessage = a2aUtils.createErrorMessage(
        'PROCESSING_ERROR',
        error.message,
        { id: 'system', name: 'System', role: a2aUtils.AgentRole.SYSTEM },
        [message.sender]
      );
      
      // Emit error event
      this.emit('message:error', errorMessage, error);
      
      return errorMessage;
    }
  }
  
  /**
   * Process a function call message
   */
  async _processFunctionCall(message) {
    const functionCall = message.content.function_call;
    const functionName = functionCall.name;
    
    // Find the function
    const func = this.functions.get(functionName);
    if (!func) {
      const errorMessage = a2aUtils.createErrorMessage(
        'FUNCTION_NOT_FOUND',
        `Function not found: ${functionName}`,
        { id: 'system', name: 'System', role: a2aUtils.AgentRole.SYSTEM },
        [message.sender]
      );
      
      this.emit('function:not_found', errorMessage);
      return errorMessage;
    }
    
    try {
      // Parse arguments
      let args;
      try {
        args = JSON.parse(functionCall.arguments);
      } catch (error) {
        // If not valid JSON, use as string
        args = functionCall.arguments;
      }
      
      // Call the function
      const result = await func.handler(args, message.sender);
      
      // Create response message
      const responseMessage = a2aUtils.createFunctionResponseMessage(
        functionName,
        result,
        { id: functionName, name: func.description, role: a2aUtils.AgentRole.FUNCTION },
        [message.sender]
      );
      
      // Emit function called event
      this.emit('function:called', message, responseMessage);
      
      // Route the response
      await this._routeMessage(responseMessage);
      
      return responseMessage;
    } catch (error) {
      this.logger.error(`Error calling function: ${functionName}`, error);
      
      // Create error message
      const errorMessage = a2aUtils.createErrorMessage(
        'FUNCTION_ERROR',
        `Error calling function ${functionName}: ${error.message}`,
        { id: 'system', name: 'System', role: a2aUtils.AgentRole.SYSTEM },
        [message.sender]
      );
      
      // Emit function error event
      this.emit('function:error', message, errorMessage, error);
      
      return errorMessage;
    }
  }
  
  /**
   * Route a message to its recipients
   */
  async _routeMessage(message) {
    const deliveryResults = [];
    
    // For each recipient
    for (const recipient of message.recipients) {
      const agent = this.agents.get(recipient.id);
      
      // If agent not found or no connection, add to undelivered
      if (!agent || !agent.connection) {
        deliveryResults.push({
          recipientId: recipient.id,
          delivered: false,
          reason: agent ? 'Agent not connected' : 'Agent not found'
        });
        continue;
      }
      
      try {
        // Emit message delivery event
        this.emit('message:delivering', message, agent);
        
        // If agent has a delivery method, use it
        if (typeof agent.connection.deliver === 'function') {
          await agent.connection.deliver(message);
          
          deliveryResults.push({
            recipientId: recipient.id,
            delivered: true
          });
          
          // Update last active timestamp
          agent.connection.lastActive = new Date();
          
          // Emit message delivered event
          this.emit('message:delivered', message, agent);
        } else {
          deliveryResults.push({
            recipientId: recipient.id,
            delivered: false,
            reason: 'No delivery method'
          });
        }
      } catch (error) {
        this.logger.error(`Error delivering message to ${recipient.id}`, error);
        
        deliveryResults.push({
          recipientId: recipient.id,
          delivered: false,
          reason: error.message
        });
        
        // Emit message delivery error event
        this.emit('message:delivery_error', message, agent, error);
      }
    }
    
    return {
      messageId: message.id,
      deliveryResults
    };
  }
  
  /**
   * Add a message to the history
   */
  _addToHistory(message) {
    // Add to sender's history
    if (message.sender && message.sender.id) {
      const senderId = message.sender.id;
      
      if (!this.messageHistory.has(senderId)) {
        this.messageHistory.set(senderId, []);
      }
      
      const history = this.messageHistory.get(senderId);
      history.push(message);
      
      // Trim history if it exceeds the maximum
      if (history.length > this.maxHistoryPerAgent) {
        history.splice