/**
 * Enhanced Build Script for PTCG-Sim-Meta
 * 
 * Comprehensive build process with advanced optimization and configuration
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Enhanced Configuration
const config = {
  rootDir: __dirname,
  clientDir: path.join(__dirname, 'client'),
  workersDir: path.join(__dirname, 'workers'),
  serverDir: path.join(__dirname, 'server'),
  distDir: path.join(__dirname, 'dist'),
  clientDistDir: path.join(__dirname, 'dist', 'client'),
  workersDistDir: path.join(__dirname, 'dist', 'workers'),
  serverDistDir: path.join(__dirname, 'dist', 'server'),
  buildTimestamp: new Date().toISOString(),
  version: '1.5.1',
  environment: process.env.NODE_ENV || 'production',
};

// Enhanced Logging
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
 * Enhanced file copy with transformation and logging
 * @param {string} src - Source file path
 * @param {string} dest - Destination file path
 * @param {Function} [transform] - Optional transformation function
 */
function copyFile(src, dest, transform = null) {
  try {
    ensureDir(path.dirname(dest));

    if (!fs.existsSync(src)) {
      log.warn(`Source file not found: ${src}`);
      return;
    }

    let content = fs.readFileSync(src, 'utf8');
    
    // Apply optional transformation
    if (transform) {
      content = transform(content);
    }

    // Replace build-time placeholders
    content = content
      .replace('__BUILD_TIMESTAMP__', config.buildTimestamp)
      .replace('__VERSION__', config.version)
      .replace('__ENVIRONMENT__', config.environment);

    fs.writeFileSync(dest, content);
    log.info(`Copied: ${src} -> ${dest}`);
  } catch (error) {
    log.error(`Error copying file: ${error.message}`);
  }
}

/**
 * Recursively copy directory with optional exclusions
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {string[]} [exclude] - Patterns to exclude
 */
function copyDir(src, dest, exclude = []) {
  ensureDir(dest);

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Check exclusions
    if (exclude.some(pattern => srcPath.includes(pattern))) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, exclude);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

/**
 * Create build metadata file
 */
function createBuildMetadata() {
  const metadata = {
    version: config.version,
    timestamp: config.buildTimestamp,
    environment: config.environment,
    nodeVersion: process.version,
    platform: process.platform
  };

  const metadataPath = path.join(config.distDir, 'build-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  log.info(`Created build metadata: ${metadataPath}`);
}

/**
 * Run build command with enhanced error handling
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
 * Minify and optimize client resources
 */
function optimizeClientResources() {
  const clientDist = config.clientDistDir;
  
  // Minify CSS
  runCommand(`find ${clientDist} -name "*.css" -exec npx postcss {} -o {} \\;`);
  
  // Optimize images
  runCommand(`find ${clientDist} -type f \\( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \\) -exec imagemin {} --out-dir={} \\;`);
  
  log.success('Client resources optimized');
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
  log.info('Building client...');
  runCommand('node esbuild.config.js', config.clientDir);
  copyDir(config.clientDir, config.clientDistDir, ['node_modules', '.git']);
  
  // Build workers
  log.info('Building workers...');
  runCommand('node esbuild.config.js', config.workersDir);
  copyDir(config.workersDir, config.workersDistDir, ['node_modules', '.git']);

  // Optional: Build server if exists
  if (fs.existsSync(config.serverDir)) {
    log.info('Building server...');
    ensureDir(config.serverDistDir);
    copyDir(config.serverDir, config.serverDistDir, ['node_modules', '.git']);
  }

  // Optimize resources
  optimizeClientResources();

  // Create build metadata
  createBuildMetadata();

  log.success('Build process completed successfully!');
  console.timeEnd('Total Build Time');
}

// Run the build
build();