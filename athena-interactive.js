/**
 * Athena Interactive Client
 * 
 * This script provides an interactive interface for Athena to:
 * 1. Send and receive messages
 * 2. Store and retrieve memories
 * 3. Call MCP tools
 */

import AthenaClient from './client/athena-client.js';
import readline from 'readline';

/**
 * Main function
 */
async function main() {
  try {
    console.log('Starting Athena Interactive Client...');
    
    // Create Athena client
    const athena = new AthenaClient();
    
    // Connect to services
    await athena.connect();
    
    // Add message handler
    athena.addMessageHandler((message) => {
      // This will be called when a message is received
      // The message is already logged and stored by the client
    });
    
    // Get message history
    console.log('\nRetrieving message history...');
    const history = await athena.getMessageHistory();
    console.log('Message history:');
    if (history.length > 0) {
      history.forEach((message, index) => {
        console.log(`${index + 1}. From: ${message.sender}, To: ${message.recipients ? message.recipients.join(', ') : 'unknown'}`);
        console.log(`   Content: ${message.content}`);
        console.log(`   Time: ${message.timestamp}`);
        console.log('---');
      });
    } else {
      console.log('No message history found');
    }
    
    // List available agents
    console.log('\nListing available agents...');
    const agents = await athena.listAgents();
    console.log('Available agents:');
    if (agents.length > 0) {
      agents.forEach(agent => {
        console.log(`- ${agent.id}: ${agent.name || 'Unknown'} (${agent.type || 'Unknown'})`);
      });
    } else {
      console.log('No agents found');
    }
    
    // Create interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log('\n=== Athena Interactive Mode ===');
    console.log('Available commands:');
    console.log('1. send <recipient> <message> - Send a message to another agent');
    console.log('2. memory <content> - Store a new memory');
    console.log('3. memories - List all memories');
    console.log('4. history - Show message history');
    console.log('5. agents - List available agents');
    console.log('6. echo <message> - Test the echo tool');
    console.log('7. exit - Exit the client');
    
    const promptUser = () => {
      rl.question('\nEnter command: ', async (input) => {
        const parts = input.trim().split(' ');
        const command = parts[0].toLowerCase();
        
        try {
          if (command === 'exit') {
            console.log('Goodbye!');
            athena.disconnect();
            rl.close();
            process.exit(0);
          }
          else if (command === 'send') {
            if (parts.length < 3) {
              console.log('Invalid format. Use: send <recipient> <message>');
            } else {
              const recipient = parts[1];
              const message = parts.slice(2).join(' ');
              
              console.log(`Sending message to ${recipient}: ${message}`);
              const response = await athena.sendMessage(recipient, message);
              console.log('Message sent successfully:', response);
            }
          }
          else if (command === 'memory') {
            if (parts.length < 2) {
              console.log('Invalid format. Use: memory <content>');
            } else {
              const content = parts.slice(1).join(' ');
              
              console.log(`Storing memory: ${content}`);
              const response = await athena.storeMemory(content, ['user_input']);
              console.log('Memory stored successfully:', response.result.id);
            }
          }
          else if (command === 'memories') {
            const memories = await athena.getMemories();
            console.log('\nMemories:');
            if (memories.length > 0) {
              memories.forEach((memory, index) => {
                console.log(`${index + 1}. ${memory.content}`);
                console.log(`   Tags: ${memory.tags ? memory.tags.join(', ') : 'none'}`);
                console.log(`   Time: ${memory.timestamp}`);
                console.log('---');
              });
            } else {
              console.log('No memories found');
            }
          }
          else if (command === 'history') {
            const history = await athena.getMessageHistory();
            console.log('\nMessage history:');
            if (history.length > 0) {
              history.forEach((message, index) => {
                console.log(`${index + 1}. From: ${message.sender}, To: ${message.recipients ? message.recipients.join(', ') : 'unknown'}`);
                console.log(`   Content: ${message.content}`);
                console.log(`   Time: ${message.timestamp}`);
                console.log('---');
              });
            } else {
              console.log('No message history found');
            }
          }
          else if (command === 'agents') {
            const agents = await athena.listAgents();
            console.log('\nAvailable agents:');
            if (agents.length > 0) {
              agents.forEach(agent => {
                console.log(`- ${agent.id}: ${agent.name || 'Unknown'} (${agent.type || 'Unknown'})`);
              });
            } else {
              console.log('No agents found');
            }
          }
          else if (command === 'echo') {
            if (parts.length < 2) {
              console.log('Invalid format. Use: echo <message>');
            } else {
              const message = parts.slice(1).join(' ');
              
              console.log(`Calling echo tool with message: ${message}`);
              const response = await athena.callTool('echo', { message });
              console.log('Echo response:', response.content[0].text);
            }
          }
          else {
            console.log('Unknown command. Try send, memory, memories, history, agents, echo, or exit.');
          }
        } catch (error) {
          console.error('Error:', error.message);
        }
        
        promptUser();
      });
    };
    
    promptUser();
    
  } catch (error) {
    console.error('Error during startup:', error);
    process.exit(1);
  }
}

// Run the main function
main();
