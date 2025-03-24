/**
 * Enhanced Build Script for PTCG-Sim-Meta
 *
 * This script handles the build process for all components of the application,
 * with special attention to content-type handling.
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

  // Skip if the source file doesn't exist
  if (!fs.existsSync(src)) {
    console.warn(`Warning: File not found: ${src}`);
    return;
  }

  // Read the source file
  const content = fs.readFileSync(src, 'utf8');

  // Apply transformation if provided
  const finalContent = transform ? transform(content) : content;

  // Write to destination
  fs.writeFileSync(dest, finalContent);
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
 * Ensure HTML files have proper metadata and doctype
 */
function ensureHtmlMetadata() {
  console.log('\n=== Ensuring HTML Metadata ===\n');

  // List all HTML files in the client dist directory
  const htmlFiles = [];
  function findHtmlFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        findHtmlFiles(fullPath);
      } else if (entry.name.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  }
  
  findHtmlFiles(config.clientDistDir);
  
  console.log(`Found ${htmlFiles.length} HTML files to process`);

  htmlFiles.forEach((filePath) => {
    const fileName = path.relative(config.clientDistDir, filePath);
    console.log(`Checking ${fileName} for proper metadata...`);

    let content = fs.readFileSync(filePath, 'utf8');

    // Ensure the file has proper doctype
    if (!content.trim().startsWith('<!DOCTYPE html>')) {
      content = '<!DOCTYPE html>\n' + content;
      console.log(`Added DOCTYPE to ${fileName}`);
    }

    // Ensure content-type meta tag exists
    if (!content.includes('<meta http-equiv="Content-Type"')) {
      const headEndPos = content.indexOf('</head>');
      if (headEndPos !== -1) {
        content =
          content.slice(0, headEndPos) +
          '\n    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n' +
          content.slice(headEndPos);
        console.log(`Added Content-Type meta tag to ${fileName}`);
      }
    }

    // Write the updated content back
    fs.writeFileSync(filePath, content, 'utf8');
  });

  console.log('HTML metadata verification complete!');
}

/**
 * Create _headers file for Cloudflare Pages
 */
function createCloudflareHeaders() {
  console.log('\n=== Creating Cloudflare Headers File ===\n');
  
  const headersPath = path.join(config.clientDistDir, '_headers');
  const headersContent = `
# Content type headers for proper MIME types
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

# JavaScript files
*.js
  Content-Type: application/javascript; charset=utf-8

# CSS files
*.css
  Content-Type: text/css; charset=utf-8

# HTML files
*.html
  Content-Type: text/html; charset=utf-8

# JSON files
*.json
  Content-Type: application/json; charset=utf-8

# Fallback for SPA routing
/*
  X-Content-Type-Options: nosniff
`;

  fs.writeFileSync(headersPath, headersContent.trim());
  console.log(`Created Cloudflare _headers file at ${headersPath}`);
}

/**
 * Create _redirects file for SPA routing
 */
function createCloudflareRedirects() {
  console.log('\n=== Creating Cloudflare Redirects File ===\n');
  
  const redirectsPath = path.join(config.clientDistDir, '_redirects');
  const redirectsContent = `
# Redirect all paths to index.html for SPA routing
/*    /index.html   200
`;

  fs.writeFileSync(redirectsPath, redirectsContent.trim());
  console.log(`Created Cloudflare _redirects file at ${redirectsPath}`);
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
    'data.json',
    'self-containers.html',
    'opp-containers.html',
  ];

  clientFiles.forEach((file) => {
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

  // Create Cloudflare Pages configuration files
  createCloudflareHeaders();
  createCloudflareRedirects();

  // Create a build info file
  const buildInfo = {
    version: '1.5.1',
    buildTimestamp: config.buildTimestamp,
    environment: process.env.NODE_ENV || 'production',
  };

  fs.writeFileSync(
    path.join(config.clientDistDir, 'build-info.json'),
    JSON.stringify(buildInfo, null, 2)
  );

  // Ensure HTML files have proper metadata
  ensureHtmlMetadata();

  console.log('Client build complete!');
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
        'BUILD_TIMESTAMP = ""',
        `BUILD_TIMESTAMP = "${config.buildTimestamp}"`
      );
    }
  );

  console.log('Workers build complete!');
}

/**
 * Main build function
 */
function build() {
  console.log('=== PTCG-Sim-Meta Build Process ===');
  console.log(`Build Timestamp: ${config.buildTimestamp}`);

  // Ensure the dist directory exists
  ensureDir(config.distDir);

  // Build each component
  buildClient();
  buildWorkers();

  console.log('\n=== Build Complete! ===\n');
}

// Run the build process
build();