# MCP Tools Guide

This guide provides an overview of the MCP tools and how to use them.

## Memory Module

The Memory Module provides persistent storage for agent memories and knowledge.

### Features

- File-based storage
- Knowledge graph capabilities
- Query interface

### Usage

```javascript
const memory = require('mcp-memory');

// Store an entity
memory.storeEntity({
  id: 'concept_123',
  type: 'concept',
  name: 'Quantum Computing',
  data: {
    description: 'Computing using quantum-mechanical phenomena'
  }
});

// Retrieve an entity
const entity = memory.getEntity('concept_123');
```

## Communications Module

The Communications Module enables agents to communicate with each other.

### Features

- WebSocket server
- Unix socket interface
- A2A protocol support

### Usage

```javascript
const comms = require('mcp-comms');

// Register an agent
comms.registerAgent({
  id: 'agent_123',
  name: 'Assistant',
  role: 'assistant'
});

// Send a message
comms.sendMessage({
  sender: 'agent_123',
  recipients: ['agent_456'],
  content: 'Hello, how can I help you today?'
});
```
