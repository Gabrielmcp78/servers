/**
 * Install Augment Memory Integration
 * 
 * This script installs the Augment Memory Integration into the Augment extensions directory
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Define paths
const AUGMENT_DIR = path.join(process.env.HOME, 'Library', 'Application Support', 'Augment');
const EXTENSIONS_DIR = path.join(AUGMENT_DIR, 'extensions');
const MEMORY_CLIENT_DIR = path.join(EXTENSIONS_DIR, 'memory-client');

// Create directories if they don't exist
function createDirectories() {
  console.log('Creating directories...');
  
  if (!fs.existsSync(AUGMENT_DIR)) {
    fs.mkdirSync(AUGMENT_DIR, { recursive: true });
    console.log(`Created ${AUGMENT_DIR}`);
  }
  
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
    console.log(`Created ${EXTENSIONS_DIR}`);
  }
  
  if (!fs.existsSync(MEMORY_CLIENT_DIR)) {
    fs.mkdirSync(MEMORY_CLIENT_DIR, { recursive: true });
    console.log(`Created ${MEMORY_CLIENT_DIR}`);
  }
}

// Copy files to the destination directory
function copyFiles() {
  console.log('Copying files...');
  
  // Files to copy
  const files = [
    'memory-client.js',
    'augment-memory-integration.js',
    'test-augment-integration.js',
    'package.json'
  ];
  
  for (const file of files) {
    const src = path.join(__dirname, file);
    const dest = path.join(MEMORY_CLIENT_DIR, file);
    
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to ${dest}`);
  }
}

// Create a README file
function createReadme() {
  console.log('Creating README...');
  
  const readmeContent = `# Augment Memory Integration

This extension integrates Augment with the MCP Memory Server, allowing Augment to store and retrieve memories.

## Usage

\`\`\`javascript
const AugmentMemoryIntegration = require('./augment-memory-integration');

// Create the integration
const memoryIntegration = new AugmentMemoryIntegration();

// Initialize the integration
await memoryIntegration.initialize();

// Store a memory
await memoryIntegration.storeMemory('This is a memory', {
  category: 'general',
  confidence: 0.9
});

// Retrieve memories related to a topic
const memories = await memoryIntegration.retrieveMemories('memory');

// Close the session
await memoryIntegration.close();
\`\`\`

## Testing

Run the test script to verify the integration:

\`\`\`
node test-augment-integration.js
\`\`\`
`;
  
  fs.writeFileSync(path.join(MEMORY_CLIENT_DIR, 'README.md'), readmeContent);
  console.log(`Created README.md`);
}

// Create a startup script for Augment
function createStartupScript() {
  console.log('Creating startup script...');
  
  const startupContent = `/**
 * Augment Memory Integration Startup Script
 * 
 * This script is executed when Augment starts up
 */

const AugmentMemoryIntegration = require('./augment-memory-integration');

// Create and initialize the memory integration
const memoryIntegration = new AugmentMemoryIntegration();

// Export the integration for use in Augment
module.exports = memoryIntegration;

// Initialize the integration
memoryIntegration.initialize()
  .then(() => {
    console.log('Memory integration initialized successfully');
  })
  .catch(error => {
    console.error('Failed to initialize memory integration:', error.message);
  });
`;
  
  fs.writeFileSync(path.join(MEMORY_CLIENT_DIR, 'startup.js'), startupContent);
  console.log(`Created startup.js`);
}

// Main installation function
async function install() {
  console.log('Installing Augment Memory Integration...');
  
  try {
    // Create directories
    createDirectories();
    
    // Copy files
    copyFiles();
    
    // Create README
    createReadme();
    
    // Create startup script
    createStartupScript();
    
    console.log('Installation completed successfully!');
    console.log(`The Augment Memory Integration has been installed to ${MEMORY_CLIENT_DIR}`);
    console.log('To test the integration, run:');
    console.log(`  cd "${MEMORY_CLIENT_DIR}" && node test-augment-integration.js`);
  } catch (error) {
    console.error('Installation failed:', error.message);
  }
}

// Run the installation
install();
