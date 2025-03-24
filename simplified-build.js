/**
 * Simplified Build Script for PTCG-Sim-Meta
 *
 * This script handles the build process for Cloudflare Pages deployment.
 * It prepares the client files and ensures proper configuration.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  rootDir: __dirname,
  clientDir: path.join(__dirname, 'client'),
  outputDir: path.join(__dirname, 'dist'),
  buildTimestamp: new Date().toISOString(),
};

// Ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    console.log(`Creating directory: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Copy file with optional transformation
function copyFile(src, dest, transform = null) {
  console.log(`Copying: ${src} -> ${dest}`);

  // Create destination directory if it doesn't exist
  ensureDir(path.dirname(dest));

  // Check if source file exists
  if (!fs.existsSync(src)) {
    console.warn(`Warning: Source file not found: ${src}`);
    return;
  }

  // Read the source file
  const content = fs.readFileSync(src, 'utf8');

  // Apply transformation if provided
  const finalContent = transform ? transform(content) : content;

  // Write to destination
  fs.writeFileSync(dest, finalContent);
}

// Recursively copy a directory
function copyDir(src, dest, excludeFiles = []) {
  ensureDir(dest);

  if (!fs.existsSync(src)) {
    console.warn(`Warning: Source directory not found: ${src}`);
    return;
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded files
    if (excludeFiles.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, excludeFiles);
    } else {
      // Skip copying node_modules and other large directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      try {
        const content = fs.readFileSync(srcPath);
        fs.writeFileSync(destPath, content);
      } catch (error) {
        console.warn(
          `Warning: Error copying file ${srcPath}: ${error.message}`
        );
      }
    }
  }
}

// Create the empty.js file
function createEmptyJsFile(dest) {
  const content = `// Empty module for redirects
export default {};
`;
  fs.writeFileSync(dest, content);
}

// Main build function
function build() {
  console.log('Starting build process...');

  // Clear output directory
  if (fs.existsSync(config.outputDir)) {
    console.log('Clearing output directory...');
    fs.rmSync(config.outputDir, { recursive: true, force: true });
  }

  // Create output directory
  ensureDir(config.outputDir);

  // Copy client files directly to output directory
  console.log('Copying client files...');
  copyDir(config.clientDir, config.outputDir);

  // Create empty.js file
  createEmptyJsFile(path.join(config.outputDir, 'empty.js'));

  // Create _headers file if it doesn't exist
  const headersPath = path.join(config.outputDir, '_headers');
  if (!fs.existsSync(headersPath)) {
    console.log('Creating _headers file...');
    const headersContent = `# Global headers
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

# JavaScript files content type
*.js
  Content-Type: application/javascript; charset=utf-8

# Worker files
/workers/src/utils/logging.js
  Content-Type: application/javascript; charset=utf-8

/workers/src/utils/cors.js
  Content-Type: application/javascript; charset=utf-8

# SPA fallback
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.socket.io; connect-src 'self' wss: https: ws:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;
`;
    fs.writeFileSync(headersPath, headersContent);
  }

  // Create _redirects file if it doesn't exist
  const redirectsPath = path.join(config.outputDir, '_redirects');
  if (!fs.existsSync(redirectsPath)) {
    console.log('Creating _redirects file...');
    const redirectsContent = `# Handle JS files with correct MIME type
/workers/src/utils/logging.js    /empty.js    200

# SPA fallback - direct all other routes to index.html
/*    /index.html    200
`;
    fs.writeFileSync(redirectsPath, redirectsContent);
  }

  // Create a build info file
  const buildInfoPath = path.join(config.outputDir, 'build-info.json');
  const buildInfo = {
    version: '1.5.1',
    timestamp: config.buildTimestamp,
    environment: process.env.NODE_ENV || 'production',
  };
  fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));

  console.log('Build complete!');
}

// Run the build
build();
