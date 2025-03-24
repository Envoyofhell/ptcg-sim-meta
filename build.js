/**
 * Simplified Build Script for PTCG-Sim-Meta
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  rootDir: __dirname,
  clientDir: path.join(__dirname, 'client'),
  workersDir: path.join(__dirname, 'workers'),
  distDir: path.join(__dirname, 'dist'),
  clientDistDir: path.join(__dirname, 'dist', 'client'),
  workersDistDir: path.join(__dirname, 'dist', 'workers'),
  buildTimestamp: new Date().toISOString(),
  version: '1.5.1',
  environment: process.env.NODE_ENV || 'production',
};

// Logging
const log = {
  info: (message) => console.log(`\x1b[34m[INFO]\x1b[0m ${message}`),
  success: (message) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`),
  warn: (message) => console.warn(`\x1b[33m[WARN]\x1b[0m ${message}`),
  error: (message) => console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`)
};

/**
 * Ensure a directory exists, creating if needed
 * @param {string} dir - Directory path
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log.info(`Created directory: ${dir}`);
  }
}

/**
 * Run build command with error handling
 * @param {string} command - Command to run
 * @param {string} [cwd] - Working directory
 */
function runCommand(command, cwd = config.rootDir) {
  try {
    log.info(`Running command: ${command}`);
    execSync(command, { 
      cwd, 
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: config.environment,
        BUILD_TIMESTAMP: config.buildTimestamp
      }
    });
  } catch (error) {
    log.error(`Command failed: ${command}`);
    process.exit(1);
  }
}

/**
 * Build client
 */
function buildClient() {
  log.info('Building client...');
  ensureDir(config.clientDistDir);
  
  // Run build command
  runCommand('npm run build', config.clientDir);
  
  log.success('Client build completed');
}

/**
 * Build workers
 */
function buildWorkers() {
  log.info('Building workers...');
  ensureDir(config.workersDistDir);
  
  // Run build command
  runCommand('npm run build', config.workersDir);
  
  log.success('Workers build completed');
}

/**
 * Main build process
 */
function build() {
  console.time('Total Build Time');
  log.info('Starting PTCG-Sim-Meta build process...');

  // Clean dist directory
  if (fs.existsSync(config.distDir)) {
    fs.rmSync(config.distDir, { recursive: true });
  }
  ensureDir(config.distDir);

  // Build client
  buildClient();
  
  // Build workers
  buildWorkers();

  log.success('Build process completed successfully!');
  console.timeEnd('Total Build Time');
}

// Run the build
build();