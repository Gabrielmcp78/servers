/**
 * A2A Protocol Utilities
 * Based on Google's Agent-to-Agent (A2A) protocol
 * https://google.github.io/A2A/
 */

const crypto = require('crypto');

// A2A Message Types
const MessageType = {
  TEXT: 'text',
  FUNCTION_CALL: 'function_call',
  FUNCTION_RESPONSE: 'function_response',
  ERROR: 'error',
  SYSTEM: 'system'
};

// A2A Agent Roles
const AgentRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  FUNCTION: 'function',
  SYSTEM: 'system'
};

/**
 * Generate a unique message ID for A2A messages
 */
function generateMessageId() {
  return `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Create a new A2A text message
 */
function createTextMessage(content, sender, recipients, options = {}) {
  return {
    id: options.id || generateMessageId(),
    type: MessageType.TEXT,
    sender: {
      id: sender.id,
      name: sender.name,
      role: sender.role || AgentRole.ASSISTANT
    },
    recipients: recipients.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role || AgentRole.ASSISTANT
    })),
    content: {
      parts: [{ text: content }]
    },
    metadata: options.metadata || {},
    timestamp: options.timestamp || new Date().toISOString()
  };
}

/**
 * Create a new A2A function call message
 */
function createFunctionCallMessage(functionName, args, sender, recipients, options = {}) {
  return {
    id: options.id || generateMessageId(),
    type: MessageType.FUNCTION_CALL,
    sender: {
      id: sender.id,
      name: sender.name,
      role: sender.role || AgentRole.ASSISTANT
    },
    recipients: recipients.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role || AgentRole.FUNCTION
    })),
    content: {
      function_call: {
        name: functionName,
        arguments: typeof args === 'string' ? args : JSON.stringify(args)
      }
    },
    metadata: options.metadata || {},
    timestamp: options.timestamp || new Date().toISOString()
  };
}

/**
 * Create a new A2A function response message
 */
function createFunctionResponseMessage(functionName, result, sender, recipients, options = {}) {
  return {
    id: options.id || generateMessageId(),
    type: MessageType.FUNCTION_RESPONSE,
    sender: {
      id: sender.id,
      name: sender.name,
      role: sender.role || AgentRole.FUNCTION
    },
    recipients: recipients.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role || AgentRole.ASSISTANT
    })),
    content: {
      function_response: {
        name: functionName,
        response: typeof result === 'string' ? result : JSON.stringify(result)
      }
    },
    metadata: options.metadata || {},
    timestamp: options.timestamp || new Date().toISOString()
  };
}

/**
 * Create a new A2A error message
 */
function createErrorMessage(errorCode, errorMessage, sender, recipients, options = {}) {
  return {
    id: options.id || generateMessageId(),
    type: MessageType.ERROR,
    sender: {
      id: sender.id,
      name: sender.name,
      role: sender.role || AgentRole.SYSTEM
    },
    recipients: recipients.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role || AgentRole.ASSISTANT
    })),
    content: {
      error: {
        code: errorCode,
        message: errorMessage
      }
    },
    metadata: options.metadata || {},
    timestamp: options.timestamp || new Date().toISOString()
  };
}

/**
 * Create a new A2A system message
 */
function createSystemMessage(content, recipients, options = {}) {
  return {
    id: options.id || generateMessageId(),
    type: MessageType.SYSTEM,
    sender: {
      id: 'system',
      name: 'System',
      role: AgentRole.SYSTEM
    },
    recipients: recipients.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role || AgentRole.ASSISTANT
    })),
    content: {
      parts: [{ text: content }]
    },
    metadata: options.metadata || {},
    timestamp: options.timestamp || new Date().toISOString()
  };
}

/**
 * Validate an A2A message
 */
function validateMessage(message) {
  // Basic structure validation
  if (!message.id) throw new Error('Message must have an id');
  if (!message.type) throw new Error('Message must have a type');
  if (!message.sender) throw new Error('Message must have a sender');
  if (!message.recipients || !Array.isArray(message.recipients) || message.recipients.length === 0) {
    throw new Error('Message must have at least one recipient');
  }
  if (!message.content) throw new Error('Message must have content');
  
  // Type-specific validation
  switch (message.type) {
    case MessageType.TEXT:
      if (!message.content.parts || !Array.isArray(message.content.parts) || message.content.parts.length === 0) {
        throw new Error('Text message must have at least one content part');
      }
      break;
      
    case MessageType.FUNCTION_CALL:
      if (!message.content.function_call) throw new Error('Function call message must have a function_call property');
      if (!message.content.function_call.name) throw new Error('Function call must have a name');
      if (!message.content.function_call.arguments) throw new Error('Function call must have arguments');
      break;
      
    case MessageType.FUNCTION_RESPONSE:
      if (!message.content.function_response) throw new Error('Function response message must have a function_response property');
      if (!message.content.function_response.name) throw new Error('Function response must have a name');
      if (!message.content.function_response.response) throw new Error('Function response must have a response');
      break;
      
    case MessageType.ERROR:
      if (!message.content.error) throw new Error('Error message must have an error property');
      if (!message.content.error.code) throw new Error('Error must have a code');
      if (!message.content.error.message) throw new Error('Error must have a message');
      break;
      
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
  
  return message;
}

module.exports = {
  MessageType,
  AgentRole,
  generateMessageId,
  createTextMessage,
  createFunctionCallMessage,
  createFunctionResponseMessage,
  createErrorMessage,
  createSystemMessage,
  validateMessage
};