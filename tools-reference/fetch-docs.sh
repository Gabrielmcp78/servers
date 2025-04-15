#!/bin/bash

# MCP Tools Reference Library - Documentation Fetcher
# This script fetches documentation for MCP tools and protocols

# Base directory
BASE_DIR="$HOME/Library/Application Support/MCP/tools-reference"

# Create directories if they don't exist
mkdir -p "$BASE_DIR/protocols/a2a"
mkdir -p "$BASE_DIR/docs"
mkdir -p "$BASE_DIR/implementations"

# Function to fetch A2A documentation
fetch_a2a() {
  echo "Fetching A2A protocol documentation..."
  cd "$BASE_DIR/protocols/a2a"
  
  # Use wget to mirror the site
  wget --mirror --convert-links --adjust-extension --page-requisites --no-parent https://google.github.io/A2A/
  
  # Move files to correct location
  if [ -d "google.github.io" ]; then
    mv google.github.io/A2A/* .
    rm -rf google.github.io
  fi
  
  echo "A2A documentation fetched successfully!"
}

# Function to create index file
create_index() {
  echo "Creating index file..."
  
  # Create a simple index file
  cat > "$BASE_DIR/index.md" << EOF
# MCP Tools Reference Library

This library contains documentation and reference implementations for MCP tools.

## Protocols

- [A2A (Agent-to-Agent) Protocol](protocols/a2a/index.html)

## Implementations

- [Memory Module](implementations/memory/README.md)
- [Communications Module](implementations/comms/README.md)

## Documentation

- [MCP Tools Guide](docs/mcp-tools-guide.md)
EOF

  echo "Index created successfully!"
}

# Function to create basic documentation
create_basic_docs() {
  echo "Creating basic documentation..."
  
  # Create MCP Tools Guide
  cat > "$BASE_DIR/docs/mcp-tools-guide.md" << EOF
# MCP Tools Guide

This guide provides an overview of the MCP tools and how to use them.

## Memory Module

The Memory Module provides persistent storage for agent memories and knowledge.

### Features

- File-based storage
- Knowledge graph capabilities
- Query interface

### Usage

\`\`\`javascript
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
\`\`\`

## Communications Module

The Communications Module enables agents to communicate with each other.

### Features

- WebSocket server
- Unix socket interface
- A2A protocol support

### Usage

\`\`\`javascript
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
\`\`\`
EOF

  echo "Basic documentation created successfully!"
}

# Function to create reference implementations
create_reference_implementations() {
  echo "Creating reference implementations..."
  
  # Create Memory Module reference
  mkdir -p "$BASE_DIR/implementations/memory"
  cat > "$BASE_DIR/implementations/memory/README.md" << EOF
# Memory Module Reference Implementation

This is a reference implementation of the MCP Memory Module.

## Features

- File-based storage
- Knowledge graph capabilities
- Query interface

## Files

- \`index.js\`: Main entry point
- \`storage-manager.js\`: File operations
- \`knowledge-graph.js\`: Graph operations
- \`query-engine.js\`: Search functionality

## Usage

See the [MCP Tools Guide](../../docs/mcp-tools-guide.md) for usage examples.
EOF

  # Create Communications Module reference
  mkdir -p "$BASE_DIR/implementations/comms"
  cat > "$BASE_DIR/implementations/comms/README.md" << EOF
# Communications Module Reference Implementation

This is a reference implementation of the MCP Communications Module.

## Features

- WebSocket server
- Unix socket interface
- A2A protocol support

## Files

- \`index.js\`: Main entry point
- \`socket-server.js\`: Socket.IO server
- \`unix-socket.js\`: Unix socket interface
- \`a2a-protocol.js\`: A2A protocol implementation

## Usage

See the [MCP Tools Guide](../../docs/mcp-tools-guide.md) for usage examples.
EOF

  echo "Reference implementations created successfully!"
}

# Main execution
echo "MCP Tools Reference Library - Documentation Fetcher"
echo "=================================================="

# Fetch A2A documentation
fetch_a2a

# Create basic documentation
create_basic_docs

# Create reference implementations
create_reference_implementations

# Create index
create_index

echo "All done! Your MCP Tools Reference Library is ready at:"
echo "$BASE_DIR"
echo ""
echo "To view the library, open the following file in your browser:"
echo "file://$BASE_DIR/index.md"