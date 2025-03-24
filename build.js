#!/usr/bin/env node

/**
 * Simple Build Script for PTCG-Sim-Meta
 * 
 * This script runs the build process for both client and workers.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const DIRS = {
  ROOT: __dirname,
  CLIENT: path.join(__dirname, 'client'),
  WORKERS: path.join(__dirname, 'workers'),
  DIST: path.join(__dirname, 'dist')
};

// Logging helper
function log(msg, type = 'info') {
  const colors = {
    info: '\x1b[36m%s\x1b[0m',    // cyan
    success: '\x1b[32m%s\x1b[0m',  // green
    warn: '\x1b[33m%s\x1b[0m',     // yellow
    error: '\x1b[31m%s\x1b[0m'     // red
  };
  
  console.log(colors[type], `[${type.toUpperCase()}] ${msg}`);
}

// Run a command and handle errors
function runCommand(command, cwd) {
  try {
    log(`Running: ${command}`);
    execSync(command, { 
      cwd, 
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });
    return true;
  } catch (error) {
    log(`Command failed: ${command}`, 'error');
    return false;
  }
}

// Ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
  }
}

// Main build function
async function build() {
  log('Starting build process...');
  
  // Create dist directory
  ensureDir(DIRS.DIST);
  
  // Build client
  log('Building client...');
  const clientSuccess = runCommand('npm run build', DIRS.CLIENT);
  
  if (clientSuccess) {
    log('Client build successful!', 'success');
  } else {
    log('Client build failed!', 'error');
  }
  
  // Build workers
  log('Building workers...');
  const workersSuccess = runCommand('npm run build', DIRS.WORKERS);
  
  if (workersSuccess) {
    log('Workers build successful!', 'success');
  } else {
    log('Workers build failed!', 'error');
  }
  
  // Build summary
  if (clientSuccess && workersSuccess) {
    log('All builds completed successfully!', 'success');
    return 0;
  } else {
    log('Build process completed with errors!', 'error');
    return 1;
  }
}

// Run the build and exit with appropriate code
build()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    log(`Build failed with error: ${error.message}`, 'error');
    process.exit(1);
  });