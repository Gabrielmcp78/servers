/**
 * Test script for Athena Communications
 * 
 * This script demonstrates how Athena can:
 * 1. Connect to the MCP server
 * 2. Send messages to other agents (like Cline)
 * 3. Receive messages from other agents
 * 4. Check message history
 */

import CommsClient from './client/comms-client.js';
import MemoryClient from './client/memory-client.js';
import readline from 'readline';

// Define the socket paths
const MCP_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/mcp-server.sock';
const MEMORY_SOCKET_PATH = '/Users/gabrielmcp/Library/Application Support/MCP/memory-server.sock';

// Define Athena's agent ID
const ATHENA_AGENT_ID = 'athena_agent';

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting Athena Communications Test...');
    
    // Create clients
    const commsClient = new CommsClient(MCP_SOCKET_PATH, ATHENA_AGENT_ID);
    const memoryClient = new MemoryClient(MEMORY_SOCKET_PATH);
    
    // Connect to the communications server
    console.log('Connecting to communications server...');
    await commsClient.connect();
    console.log('Connected to communications server');
    
    // Set up message callback
    commsClient.setMessageCallback((message) => {
      console.log('\n=== Incoming Message ===');
      console.log(`From: ${message.sender}`);
      console.log(`Content: ${message.content}`);
      console.log(`Timestamp: ${message.timestamp}`);
      console.log('=========================\n');
      
      // Store the message in memory
      storeMessageInMemory(memoryClient, message);
    });
    
    // List available agents
    console.log('\nListing available agents...');
    try {
      const agentsResponse = await commsClient.listAgents();
      console.log('Available agents:');
      if (agentsResponse && agentsResponse.content) {
        const agents = JSON.parse(agentsResponse.content[0].text);
        agents.forEach(agent => {
          console.log(`- ${agent.id}: ${agent.name} (${agent.type})`);
        });
      } else {
        console.log('No agents found or listAgents tool not available');
      }
    } catch (error) {
      console.log('Failed to list agents:', error.message);
    }
    
    // Get message history
    console.log('\nGetting message history...');
    try {
      const historyResponse = await commsClient.getMessageHistory();
      console.log('Message history:');
      if (historyResponse && historyResponse.content) {
        const history = JSON.parse(historyResponse.content[0].text);
        history.forEach(message => {
          console.log(`- From: ${message.sender}, To: ${message.recipients.join(', ')}, Content: ${message.content}`);
        });
      } else {
        console.log('No message history found or getMessageHistory tool not available');
      }
    } catch (error) {
      console.log('Failed to get message history:', error.message);
    }
    
    // Create interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n=== Athena Interactive Mode ===');
    console.log('You can send messages to other agents.');
    console.log('Format: <recipient> <message>');
    console.log('Example: cline Hello, Cline! This is Athena.');
    console.log('Type "exit" to quit.');
    
    const promptUser = () => {
      rl.question('\nEnter command: ', async (input) => {
        const trimmedInput = input.trim();
        
        if (trimmedInput.toLowerCase() === 'exit') {
          console.log('Goodbye!');
          commsClient.disconnect();
          rl.close();
          process.exit(0);
        } else {
          const firstSpace = trimmedInput.indexOf(' ');
          if (firstSpace > 0) {
            const recipient = trimmedInput.substring(0, firstSpace);
            const message = trimmedInput.substring(firstSpace + 1);
            
            try {
              console.log(`Sending message to ${recipient}: ${message}`);
              const response = await commsClient.sendMessage(recipient, message);
              console.log('Message sent successfully:', response);
              
              // Store the sent message in memory
              const sentMessage = {
                sender: ATHENA_AGENT_ID,
                recipients: [recipient],
                content: message,
                timestamp: new Date().toISOString()
              };
              storeMessageInMemory(memoryClient, sentMessage);
              
            } catch (error) {
              console.error('Failed to send message:', error);
            }
          } else {
            console.log('Invalid format. Use: <recipient> <message>');
          }
        }
        
        promptUser();
      });
    };
    
    promptUser();
    
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

/**
 * Store a message in memory
 */
async function storeMessageInMemory(memoryClient, message) {
  try {
    const memoryEntity = {
      id: `message_${Date.now()}`,
      type: 'message',
      content: message.content,
      agentId: ATHENA_AGENT_ID,
      sender: message.sender,
      recipients: message.recipients,
      timestamp: message.timestamp || new Date().toISOString(),
      tags: ['message', message.sender]
    };
    
    const result = await memoryClient.storeEntity(memoryEntity);
    console.log('Message stored in memory:', result.result.id);
  } catch (error) {
    console.error('Failed to store message in memory:', error);
  }
}

// Run the main function
main();
