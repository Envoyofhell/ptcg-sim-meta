/**
 * PTCG-Sim-Meta Worker Entry Point
 *
 * This is the main entry file for the Cloudflare Worker that handles
 * API requests, Socket.IO connections, and ensures proper MIME types for static files.
 *
 * File: workers/index.js
 */

import { Router } from 'itty-router';
import { corsHeaders, handleOptions } from './src/utils/cors.js';
import { logger } from './src/utils/logging.js';
import { errorResponse } from './src/utils/error-handling.js';

// Import API handlers
import * as gameStateApi from './src/api/game-state.js';
import * as healthApi from './src/api/health.js';
import * as socketIoHandler from './src/socket/socket-handler.js';

/**
 * Create a new router instance for handling API routes
 */
const router = Router();

/**
 * Register API routes with the router
 */

// Handle CORS preflight requests
router.options('*', handleOptions);

// Health check endpoints
router.get('/health', healthApi.getHealth);
router.get('/api/health', healthApi.getHealth);

// Game state management endpoints
router.get('/api/importData', gameStateApi.getGameState);
router.post('/api/storeGameState', gameStateApi.storeGameState);
router.delete('/api/gameState/:key', gameStateApi.deleteGameState);
router.get('/api/stats', gameStateApi.getStats);

// Socket.IO emulation endpoints
router.get('/socket.io/', socketIoHandler.handleSocketHandshake);
router.post('/socket.io/', socketIoHandler.handleSocketPolling);
router.get('/socket.io/:id', socketIoHandler.handleSocketPolling);

// Debug route - helps to check if the worker is serving JS files correctly
router.get('/api/debug', (request) => {
  const timestamp = new Date().toISOString();

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Worker is running correctly',
      timestamp,
      environment: request.env?.ENVIRONMENT || 'production',
      version: request.env?.WORKER_VERSION || '1.5.1',
      buildTimestamp: request.env?.BUILD_TIMESTAMP || timestamp,
      headers: Object.fromEntries([...request.headers.entries()]),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
});

// Catch-all for any unrecognized API routes
router.all('/api/*', () => {
  return errorResponse(404, 'API endpoint not found');
});

/**
 * Get the appropriate content type for a file path
 *
 * @param {string} path - File path
 * @returns {string} Content type
 */
function getContentType(path) {
  // First handle HTML files and default pages
  if (path.endsWith('.html') || path === '/' || path.endsWith('/')) {
    return 'text/html; charset=utf-8';
  }

  const extensionMap = {
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
    '.wasm': 'application/wasm',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  };

  // Check if path ends with one of the extensions
  for (const [extension, contentType] of Object.entries(extensionMap)) {
    if (path.endsWith(extension)) {
      return contentType;
    }
  }

  // Default content type
  return 'application/octet-stream';
}

/**
 * Handle HTML requests specifically
 *
 * @param {Request} request - The incoming request
 * @param {URL} url - Parsed URL
 * @returns {Response} Modified response with correct headers
 */
async function handleHtmlRequest(request, url) {
  logger.debug(`Handling HTML request: ${url.pathname}`, 'router');

  try {
    // Fetch the original resource
    const originalResponse = await fetch(request);

    // Check if the response was successful
    if (!originalResponse.ok) {
      logger.warn(
        `Failed to fetch HTML: ${url.pathname} (${originalResponse.status})`,
        'router'
      );
      return originalResponse; // Pass through error responses
    }

    // Get the response body
    const body = await originalResponse.text();

    // Create a new response with the correct MIME type
    return new Response(body, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers: {
        ...Object.fromEntries([...originalResponse.headers.entries()]),
        'Content-Type': 'text/html; charset=utf-8',
        ...corsHeaders,
      },
    });
  } catch (error) {
    logger.error(`Error handling HTML request: ${error.message}`, 'router');
    return fetch(request); // Fallback to original request
  }
}

/**
 * Check if a path is a critical JavaScript file
 *
 * @param {string} pathname - Path name
 * @returns {boolean} Whether the path is a critical JS file
 */
function isCriticalJsFile(pathname) {
  const criticalPaths = [
    '/workers/src/utils/logging.js',
    '/workers/src/utils/cors.js',
    '/workers/src/utils/key-generator.js',
    '/workers/src/utils/error-handling.js',
    '/workers/src/db/client.js',
    '/workers/src/db/game-state.js',
    '/workers/src/api/game-state.js',
    '/workers/src/api/health.js',
    '/workers/dist/worker.js',
  ];

  return criticalPaths.includes(pathname);
}

/**
 * Create stub module content
 *
 * @param {string} moduleName - Module name
 * @returns {string} Module content
 */
function createStubModule(moduleName) {
  switch (moduleName) {
    case 'logging':
      return `
// Stub logging module
export const log = (message, level = 'info', context = '') => console[level](\`[\${level.toUpperCase()}]\${context ? \` [\${context}]\` : ''} \${message}\`);
export const logger = { debug: (m, c) => log(m, 'debug', c), info: (m, c) => log(m, 'info', c), warn: (m, c) => log(m, 'warn', c), error: (m, c) => log(m, 'error', c) };
export default log;`;

    case 'cors':
      return `
// Stub CORS module
export const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
export const handleOptions = () => new Response(null, { status: 204, headers: corsHeaders });
export default { corsHeaders, handleOptions };`;

    case 'key-generator':
      return `
// Stub key generator module
export const generateRandomKey = (length = 4) => Array.from({ length }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
export const isValidKey = (key) => typeof key === 'string' && /^[a-zA-Z0-9]+$/.test(key);
export default { generateRandomKey, isValidKey };`;

    case 'error-handling':
      return `
// Stub error handling module
export const errorResponse = (status, message, details = {}) => new Response(JSON.stringify({ success: false, error: message, ...details }), { status, headers: { 'Content-Type': 'application/json' } });
export default { errorResponse };`;

    default:
      return `
// Stub module
export default {};`;
  }
}

/**
 * Run maintenance tasks periodically
 *
 * @param {Object} env - Worker environment variables
 */
async function runMaintenance(env) {
  try {
    // Clean up inactive socket connections
    socketIoHandler.cleanupInactiveConnections();

    // Log the maintenance run
    logger.info('Scheduled maintenance completed', 'maintenance');
  } catch (error) {
    logger.error(`Error during maintenance: ${error.message}`, 'maintenance');
  }
}

/**
 * Main Worker export - this is the entry point Cloudflare calls
 */
export default {
  /**
   * Main fetch handler for all incoming requests
   *
   * @param {Request} request - The incoming HTTP request
   * @param {Object} env - Environment variables and bindings
   * @param {Object} ctx - Execution context
   * @returns {Response} HTTP response
   */
  async fetch(request, env, ctx) {
    try {
      // Add environment to request for handlers to access
      request.env = env;

      // Configure logger
      if (env.LOG_LEVEL) {
        logger.updateConfig({ level: env.LOG_LEVEL });
      }

      // Parse the URL from the request
      const url = new URL(request.url);

      // Log requests in debug mode
      logger.debug(`${request.method} ${url.pathname}`, 'router');

      // -------------------------------------------------------------------------
      // PART 1: API REQUEST HANDLING
      // -------------------------------------------------------------------------

      // For API requests, use the router
      if (
        url.pathname.startsWith('/api/') ||
        url.pathname === '/health' ||
        url.pathname.startsWith('/socket.io')
      ) {
        logger.debug(`Handling API request: ${url.pathname}`, 'router');

        // Check if Socket.IO is enabled for socket.io paths
        if (
          url.pathname.startsWith('/socket.io') &&
          env.SOCKET_ENABLED !== 'true'
        ) {
          return errorResponse(503, 'Socket.IO is currently disabled');
        }

        const response = await router.handle(request);

        // Add CORS headers to all responses
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });

        return response;
      }

      // -------------------------------------------------------------------------
      // PART 2: HTML CONTENT HANDLING
      // -------------------------------------------------------------------------

      // Special handling for HTML files and directory index requests
      if (
        url.pathname.endsWith('.html') ||
        url.pathname === '/' ||
        url.pathname.endsWith('/')
      ) {
        return handleHtmlRequest(request, url);
      }

      // -------------------------------------------------------------------------
      // PART 3: STATIC FILE HANDLING WITH MIME TYPE CORRECTION
      // -------------------------------------------------------------------------

      // Special handling for critical JS files
      if (isCriticalJsFile(url.pathname)) {
        logger.debug(`Handling critical JS file: ${url.pathname}`, 'router');

        // Extract module name from path
        const moduleName = url.pathname.split('/').pop().replace('.js', '');

        // Return stub content
        return new Response(createStubModule(moduleName), {
          status: 200,
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            ...corsHeaders,
          },
        });
      }

      // For files with extensions, ensure correct MIME type
      const contentType = getContentType(url.pathname);
      if (contentType !== 'application/octet-stream') {
        try {
          logger.debug(
            `Handling file with content type: ${contentType}`,
            'router'
          );

          // Fetch the original resource
          const originalResponse = await fetch(request);

          // Check if the response was successful
          if (!originalResponse.ok) {
            logger.warn(
              `Failed to fetch file: ${url.pathname} (${originalResponse.status})`,
              'router'
            );
            return originalResponse; // Pass through error responses
          }

          // Create a new response with the correct MIME type
          return new Response(originalResponse.body, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers: {
              ...Object.fromEntries([...originalResponse.headers.entries()]),
              'Content-Type': contentType,
              ...corsHeaders,
            },
          });
        } catch (error) {
          logger.error(`Error handling file: ${error.message}`, 'router');
          return fetch(request); // Fallback to original request
        }
      }

      // -------------------------------------------------------------------------
      // PART 4: PASS-THROUGH FOR OTHER REQUESTS
      // -------------------------------------------------------------------------

      // For all other requests, pass through
      return fetch(request);
    } catch (error) {
      // -------------------------------------------------------------------------
      // PART 5: ERROR HANDLING
      // -------------------------------------------------------------------------

      // Log detailed error information
      logger.error(`Error handling request: ${error.message}`, 'router', {
        stack: error.stack,
        url: request.url,
        method: request.method,
      });

      // Return a structured JSON error response
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Internal Server Error',
          message: error.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  },

  /**
   * Scheduled handler for maintenance tasks
   *
   * @param {Object} event - Scheduled event
   * @param {Object} env - Environment variables and bindings
   * @param {Object} ctx - Execution context
   */
  async scheduled(event, env, ctx) {
    logger.info(
      `Running scheduled maintenance (${event.scheduledTime})`,
      'maintenance'
    );

    // Use waitUntil to keep the worker running until maintenance completes
    ctx.waitUntil(runMaintenance(env));
  },
};
