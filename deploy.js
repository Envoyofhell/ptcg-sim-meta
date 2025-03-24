/**
 * PTCG-Sim-Meta Deployment Script
 * 
 * This script handles the deployment process for both Cloudflare Pages (client)
 * and Cloudflare Workers (server) components of the application.
 * 
 * File: deploy.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  // Build timestamp for versioning
  buildTimestamp: new Date().toISOString(),
  
  // Environment - can be 'dev' or 'production'
  environment: process.env.DEPLOY_ENV || process.argv[2] || 'dev',
  
  // Whether to skip the build step
  skipBuild: process.argv.includes('--skip-build'),
  
  // Whether to deploy only pages or only workers
  deployOnlyPages: process.argv.includes('--pages-only'),
  deployOnlyWorkers: process.argv.includes('--workers-only'),
  
  // Path to client and workers directories
  clientDir: path.join(__dirname, 'client'),
  workersDir: path.join(__dirname, 'workers'),
  distDir: path.join(__dirname, 'dist')
};

/**
 * Log a message to the console
 * @param {string} message - Message to log
 * @param {string} level - Log level
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level.toUpperCase();
  
  // Use different console methods based on level
  switch (level) {
    case 'error':
      console.error(`[${timestamp}] [${prefix}] ${message}`);
      break;
    case 'warn':
      console.warn(`[${timestamp}] [${prefix}] ${message}`);
      break;
    case 'debug':
      console.debug(`[${timestamp}] [${prefix}] ${message}`);
      break;
    default:
      console.log(`[${timestamp}] [${prefix}] ${message}`);
  }
}

/**
 * Run a command and log the output
 * @param {string} command - Command to run
 * @param {string} cwd - Working directory
 * @param {boolean} silent - Whether to suppress output
 * @returns {string} Command output
 */
function runCommand(command, cwd = __dirname, silent = false) {
  log(`Running command: ${command}`, 'debug');
  
  try {
    const output = execSync(command, {
      cwd,
      stdio: silent ? 'pipe' : 'inherit'
    });
    
    return output ? output.toString() : '';
  } catch (error) {
    log(`Command failed: ${command}`, 'error');
    log(error.message, 'error');
    
    if (error.stdout) {
      log(`Command output: ${error.stdout.toString()}`, 'debug');
    }
    
    if (error.stderr) {
      log(`Command error output: ${error.stderr.toString()}`, 'error');
    }
    
    throw error;
  }
}

/**
 * Build the application
 */
function buildApplication() {
  if (config.skipBuild) {
    log('Skipping build step', 'warn');
    return;
  }
  
  log('Building application...');
  
  // Run the build script
  runCommand('node build.js');
  
  log('Build complete!');
}

/**
 * Deploy the application to Cloudflare Pages
 */
function deployToPages() {
  if (config.deployOnlyWorkers) {
    log('Skipping Pages deployment', 'warn');
    return;
  }
  
  log(`Deploying to Cloudflare Pages (${config.environment})...`);
  
  // Check if Wrangler is installed
  try {
    runCommand('npx wrangler --version', __dirname, true);
  } catch (error) {
    log('Wrangler not found. Installing...', 'warn');
    runCommand('npm install -g wrangler');
  }
  
  // Deploy to Pages
  try {
    // Create a pages project if it doesn't exist
    try {
      runCommand(`npx wrangler pages project get ptcg-sim-meta-${config.environment}`, __dirname, true);
    } catch (error) {
      log('Pages project not found. Creating...', 'warn');
      runCommand(`npx wrangler pages project create ptcg-sim-meta-${config.environment} --production-branch main`);
    }
    
    // Deploy the client directory to Pages
    runCommand(`npx wrangler pages deploy ${path.join(config.distDir, 'client')} --project-name=ptcg-sim-meta-${config.environment} --commit-message="Deploy ${config.buildTimestamp}" --branch=${config.environment === 'production' ? 'main' : 'dev'}`);
    
    log('Pages deployment complete!');
  } catch (error) {
    log('Pages deployment failed!', 'error');
    throw error;
  }
}

/**
 * Deploy the application to Cloudflare Workers
 */
function deployToWorkers() {
  if (config.deployOnlyPages) {
    log('Skipping Workers deployment', 'warn');
    return;
  }
  
  log(`Deploying to Cloudflare Workers (${config.environment})...`);
  
  // Check if Wrangler is installed
  try {
    runCommand('npx wrangler --version', __dirname, true);
  } catch (error) {
    log('Wrangler not found. Installing...', 'warn');
    runCommand('npm install -g wrangler');
  }
  
  // Deploy to Workers
  try {
    // Change to the workers directory
    process.chdir(path.join(config.distDir, 'workers'));
    
    // Deploy the worker
    runCommand(`npx wrangler deploy --env ${config.environment}`);
    
    // Return to the original directory
    process.chdir(__dirname);
    
    log('Workers deployment complete!');
  } catch (error) {
    // Return to the original directory
    process.chdir(__dirname);
    
    log('Workers deployment failed!', 'error');
    throw error;
  }
}

/**
 * Main deployment function
 */
function deploy() {
  log(`Starting deployment (${config.environment})...`);
  log(`Build timestamp: ${config.buildTimestamp}`);
  
  try {
    // Build the application
    buildApplication();
    
    // Deploy to Pages and Workers
    deployToPages();
    deployToWorkers();
    
    log('Deployment complete!');
  } catch (error) {
    log('Deployment failed!', 'error');
    process.exit(1);
  }
}

// Run the deployment
deploy();