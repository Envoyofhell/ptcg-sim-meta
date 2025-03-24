/**
 * PTCG-Sim-Meta Build Script
 * 
 * This script handles the build process for all components of the application:
 * - Client (Cloudflare Pages)
 * - Workers (Cloudflare Workers)
 * - Server (Express.js)
 * 
 * It ensures that all paths are correctly resolved and files are placed in the right locations.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  // Project root is the directory where this script is located
  rootDir: __dirname,
  
  // Component directories
  clientDir: path.join(__dirname, 'client'),
  workersDir: path.join(__dirname, 'workers'),
  serverDir: path.join(__dirname, 'server'),
  
  // Output directories
  distDir: path.join(__dirname, 'dist'),
  clientDistDir: path.join(__dirname, 'dist', 'client'),
  workersDistDir: path.join(__dirname, 'dist', 'workers'),
  
  // Environment
  isDev: process.env.NODE_ENV !== 'production',
  
  // Build timestamp
  buildTimestamp: new Date().toISOString()
};

/**
 * Ensure a directory exists, creating it if needed
 * @param {string} dir - Directory path
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Copy a file with optional transformation
 * @param {string} src - Source file path
 * @param {string} dest - Destination file path
 * @param {Function} transform - Optional transformation function for file content
 */
function copyFile(src, dest, transform = null) {
  console.log(`Copying: ${src} -> ${dest}`);
  
  // Create destination directory if it doesn't exist
  ensureDir(path.dirname(dest));
  
  // Read the source file
  const content = fs.readFileSync(src, 'utf8');
  
  // Apply transformation if provided
  const finalContent = transform ? transform(content) : content;
  
  // Write to destination
  fs.writeFileSync(dest, finalContent);
}

/**
 * Run a command and log the output
 * @param {string} command - Command to run
 * @param {string} cwd - Working directory
 */
function runCommand(command, cwd = config.rootDir) {
  console.log(`Running command: ${command} in ${cwd}`);
  try {
    const output = execSync(command, { cwd, stdio: 'inherit' });
    return output;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Build the client application
 */
function buildClient() {
  console.log('\n=== Building Client ===\n');
  
  // Ensure output directory exists
  ensureDir(config.clientDistDir);
  
  // Copy static files from client directory to client dist
  const clientFiles = [
    'index.html', 
    '_headers', 
    '_redirects', 
    'data.json',
    'self-containers.html',
    'opp-containers.html'
  ];
  
  clientFiles.forEach(file => {
    const src = path.join(config.clientDir, file);
    const dest = path.join(config.clientDistDir, file);
    
    if (fs.existsSync(src)) {
      copyFile(src, dest);
    } else {
      console.warn(`Warning: File not found: ${src}`);
    }
  });
  
  // Copy client src directory recursively
  copyDir(
    path.join(config.clientDir, 'src'), 
    path.join(config.clientDistDir, 'src')
  );
  
  // Create a build info file
  const buildInfo = {
    version: require('./package.json').version,
    buildTimestamp: config.buildTimestamp,
    environment: config.isDev ? 'development' : 'production'
  };
  
  fs.writeFileSync(
    path.join(config.clientDistDir, 'build-info.json'),
    JSON.stringify(buildInfo, null, 2)
  );
  
  console.log('Client build complete!');
}

/**
 * Recursively copy a directory
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
function copyDir(src, dest) {
  ensureDir(dest);
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

/**
 * Build the worker application
 */
function buildWorkers() {
  console.log('\n=== Building Workers ===\n');
  
  // Ensure output directory exists
  ensureDir(config.workersDistDir);
  
  // Use esbuild to bundle the worker code
  console.log('Bundling worker code with esbuild...');
  
  // Run the worker build script
  runCommand('node esbuild.config.js', config.workersDir);
  
  // Copy the worker dist files
  copyDir(
    path.join(config.workersDir, 'dist'),
    path.join(config.workersDistDir, 'dist')
  );
  
  // Copy wrangler.toml with environment variables
  copyFile(
    path.join(config.workersDir, 'wrangler.toml'),
    path.join(config.workersDistDir, 'wrangler.toml'),
    (content) => {
      // Replace build timestamp placeholder
      return content.replace(
        'WORKER_VERSION = "1.5.1"',
        `WORKER_VERSION = "1.5.1"\n  BUILD_TIMESTAMP = "${config.buildTimestamp}"`
      );
    }
  );
  
  // Create a dummy empty.js file for redirects
  fs.writeFileSync(
    path.join(config.clientDistDir, 'empty.js'),
    '// Empty module for redirects\n'
  );
  
  console.log('Workers build complete!');
}

/**
 * Fix critical module paths
 */
function fixModulePaths() {
  console.log('\n=== Fixing Module Paths ===\n');
  
  // Create necessary utility modules directly in the client dist directory
  // This fixes the issue where the build process looks for worker files in the client folder
  
  // Create logging module
  const loggingContent = `
// Inline logging module for PTCG-Sim-Meta
// This file is automatically generated during build

/**
 * Simple logging utility for browser environment
 */
export const log = function(message, level = 'info', context = '') {
  const timestamp = new Date().toISOString();
  const prefix = level.toUpperCase();
  
  // Format the message
  const formattedMessage = \`[\${timestamp}] [\${prefix}]\${context ? \` [\${context}]\` : ''} \${message}\`;
  
  // Use appropriate console method
  switch (level) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'debug':
      console.debug(formattedMessage);
      break;
    case 'info':
    default:
      console.info(formattedMessage);
  }
  
  return { timestamp, level, message, context };
};

// For compatibility with both named and default exports
export default log;

// Legacy API compatibility
export const logger = {
  debug: (message, context = '') => log(message, 'debug', context),
  info: (message, context = '') => log(message, 'info', context),
  warn: (message, context = '') => log(message, 'warn', context),
  error: (message, context = '') => log(message, 'error', context),
  log: (message, level = 'info', context = '') => log(message, level, context)
};
`;

  // Write the logging module to the client dist
  const loggingDirs = [
    path.join(config.clientDistDir, 'workers', 'src', 'utils'),
    path.join(config.clientDistDir, 'src', 'utils')
  ];
  
  loggingDirs.forEach(dir => {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'logging.js'), loggingContent);
  });

  // Create CORS utility module
  const corsContent = `
// Inline CORS utility for PTCG-Sim-Meta
// This file is automatically generated during build

/**
 * CORS headers for cross-origin requests
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400' // 24 hours
};

/**
 * Handle OPTIONS requests for CORS preflight
 * 
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response with CORS headers
 */
export function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

// For compatibility with both named and default exports
export default { corsHeaders, handleOptions };
`;

  // Write the CORS module to the client dist
  const corsDirs = [
    path.join(config.clientDistDir, 'workers', 'src', 'utils'),
    path.join(config.clientDistDir, 'src', 'utils')
  ];
  
  corsDirs.forEach(dir => {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'cors.js'), corsContent);
  });

  // Create key generator utility
  const keyGeneratorContent = `
// Inline key generator utility for PTCG-Sim-Meta
// This file is automatically generated during build

/**
 * Generate a random alphanumeric key
 * 
 * @param {number} length - Length of the key
 * @returns {string} Random alphanumeric key
 */
export function generateRandomKey(length = 4) {
  const characters = 
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    key += characters.charAt(randomIndex);
  }
  
  return key;
}

/**
 * Validate a key format
 * 
 * @param {string} key - Key to validate
 * @param {number} length - Expected length
 * @returns {boolean} Whether the key is valid
 */
export function isValidKey(key, length = 4) {
  // Key must be a string
  if (typeof key !== 'string') {
    return false;
  }
  
  // Key must be the right length
  if (key.length !== length) {
    return false;
  }
  
  // Key must contain only alphanumeric characters
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(key);
}

// For compatibility with both named and default exports
export default { generateRandomKey, isValidKey };
`;

  // Write the key generator module to the client dist
  const keyGenDirs = [
    path.join(config.clientDistDir, 'workers', 'src', 'utils'),
    path.join(config.clientDistDir, 'src', 'utils')
  ];
  
  keyGenDirs.forEach(dir => {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'key-generator.js'), keyGeneratorContent);
  });

  // Create error handling utility
  const errorHandlingContent = `
// Inline error handling utility for PTCG-Sim-Meta
// This file is automatically generated during build

/**
 * Create a structured error response
 * 
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {Response} HTTP response with error details
 */
export function errorResponse(status, message, details = {}) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
  
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      status,
      ...details
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}

// For compatibility with both named and default exports
export default { errorResponse };
`;

  // Write the error handling module to the client dist
  const errorHandlingDirs = [
    path.join(config.clientDistDir, 'workers', 'src', 'utils'),
    path.join(config.clientDistDir, 'src', 'utils')
  ];
  
  errorHandlingDirs.forEach(dir => {
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'error-handling.js'), errorHandlingContent);
  });

  console.log('Module paths fixed!');
}

/**
 * Fix global-variables.js to include BUILD_TIMESTAMP
 */
function fixGlobalVariables() {
  console.log('\n=== Fixing Global Variables ===\n');
  
  const globalVarsPath = path.join(
    config.clientDistDir, 
    'src', 
    'initialization', 
    'global-variables', 
    'global-variables.js'
  );
  
  if (fs.existsSync(globalVarsPath)) {
    console.log(`Updating ${globalVarsPath}`);
    
    let content = fs.readFileSync(globalVarsPath, 'utf8');
    
    // Replace the BUILD_TIMESTAMP placeholder
    content = content.replace(
      "const BUILD_TIMESTAMP = '__BUILD_TIMESTAMP__';",
      `const BUILD_TIMESTAMP = '${config.buildTimestamp}';`
    );
    
    fs.writeFileSync(globalVarsPath, content);
    console.log('Global variables updated!');
  } else {
    console.warn(`Warning: ${globalVarsPath} not found, skipping`);
  }
}

/**
 * Main build function
 */
function build() {
  console.log('=== PTCG-Sim-Meta Build Process ===');
  console.log(`Environment: ${config.isDev ? 'Development' : 'Production'}`);
  console.log(`Build Timestamp: ${config.buildTimestamp}`);
  
  // Ensure the dist directory exists
  ensureDir(config.distDir);
  
  // Build each component
  buildClient();
  buildWorkers();
  
  // Fix paths and configurations
  fixModulePaths();
  fixGlobalVariables();
  
  console.log('\n=== Build Complete! ===\n');
}

// Run the build process
build();