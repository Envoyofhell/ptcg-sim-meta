/**
 * PTCG-Sim-Meta Worker Entry Point
 * 
 * This is the main entry file for the Cloudflare Worker that handles
 * API requests and ensures proper MIME types for static files.
 * 
 * Enhanced with:
 * - Better error handling and reporting
 * - Improved module path resolution
 * - Proper MIME type handling
 * - Detailed logging
 */

import { Router } from 'itty-router';
import { corsHeaders, handleOptions } from './src/utils/cors.js';
import { logger } from './src/utils/logging.js';
import { errorResponse } from './src/utils/error-handling.js';

// Import API handlers
import * as gameStateApi from './src/api/game-state.js';
import * as healthApi from './src/api/health.js';

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

// Debug route - helps to check if the worker is serving JS files correctly
router.get('/api/debug', (request) => {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Worker is running correctly',
      timestamp: new Date().toISOString(),
      environment: request.env.ENVIRONMENT || 'production',
      headers: Object.fromEntries([...request.headers.entries()])
    }),
    { 
      status: 200, 
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
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
  if (path.endsWith('.js') || path.includes('.module.js') || path.endsWith('.mjs')) {
    return 'application/javascript; charset=utf-8';
  } else if (path.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  } else if (path.endsWith('.json') || path.endsWith('.map')) {
    return 'application/json; charset=utf-8';
  } else if (path.endsWith('.svg')) {
    return 'image/svg+xml';
  } else if (path.endsWith('.webmanifest')) {
    return 'application/manifest+json';
  } else if (path.endsWith('.wasm')) {
    return 'application/wasm';
  } else if (path.endsWith('.woff2')) {
    return 'font/woff2';
  } else if (path.endsWith('.woff')) {
    return 'font/woff';
  } else if (path.endsWith('.ttf')) {
    return 'font/ttf';
  } else if (path.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  } else {
    return 'application/octet-stream';
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
    '/workers/dist/worker.js'
  ];
  
  return criticalPaths.includes(pathname);
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
      if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
        logger.debug(`Handling API request: ${url.pathname}`, 'router');
        
        const response = await router.handle(request);
        
        // Add CORS headers to all responses
        Object.entries(corsHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        
        return response;
      }
      
      // -------------------------------------------------------------------------
      // PART 2: STATIC FILE HANDLING WITH MIME TYPE CORRECTION
      // -------------------------------------------------------------------------
      
      // Special handling for critical JS files
      if (isCriticalJsFile(url.pathname)) {
        logger.debug(`Handling critical JS file: ${url.pathname}`, 'router');
        
        // Add specific debugging for logging.js
        if (url.pathname === '/workers/src/utils/logging.js') {
          logger.debug('Handling logging.js request', 'router');
          
          // For debugging purposes, return the actual code to verify it's working
          return new Response(
            `// Logging module
const logger = {
  debug: (message) => console.debug('[DEBUG]', message),
  info: (message) => console.info('[INFO]', message),
  warn: (message) => console.warn('[WARNING]', message),
  error: (message) => console.error('[ERROR]', message)
};

export { logger };
export default logger;
`,
            {
              status: 200,
              headers: {
                'Content-Type': 'application/javascript; charset=utf-8',
                ...corsHeaders
              }
            }
          );
        }
      }
      
      // For JavaScript files, ensure correct MIME type
      if (
        url.pathname.endsWith('.js') || 
        url.pathname.endsWith('.mjs') ||
        url.pathname.includes('.module.js')
      ) {
        try {
          logger.debug(`Handling JavaScript file: ${url.pathname}`, 'router');
          
          // Fetch the original resource
          const originalResponse = await fetch(request);
          
          // Check if the response was successful
          if (!originalResponse.ok) {
            logger.warn(`Failed to fetch JavaScript file: ${url.pathname} (${originalResponse.status})`, 'router');
            return originalResponse; // Pass through error responses
          }
          
          // Create a new response with the correct MIME type
          return new Response(originalResponse.body, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers: {
              ...Object.fromEntries([...originalResponse.headers.entries()]),
              'Content-Type': 'application/javascript; charset=utf-8',
              ...corsHeaders
            }
          });
        } catch (error) {
          logger.error(`Error handling JavaScript file: ${error.message}`, 'router');
          return fetch(request); // Fallback to original request
        }
      }
      
      // For CSS files, ensure correct MIME type
      if (url.pathname.endsWith('.css')) {
        try {
          logger.debug(`Handling CSS file: ${url.pathname}`, 'router');
          
          const originalResponse = await fetch(request);
          
          if (!originalResponse.ok) {
            return originalResponse;
          }
          
          return new Response(originalResponse.body, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers: {
              ...Object.fromEntries([...originalResponse.headers.entries()]),
              'Content-Type': 'text/css; charset=utf-8',
              ...corsHeaders
            }
          });
        } catch (error) {
          logger.error(`Error handling CSS file: ${error.message}`, 'router');
          return fetch(request); // Fallback to original request
        }
      }
      
      // For JSON and map files, ensure correct MIME type
      if (url.pathname.endsWith('.json') || url.pathname.endsWith('.map')) {
        try {
          logger.debug(`Handling JSON/map file: ${url.pathname}`, 'router');
          
          const originalResponse = await fetch(request);
          
          if (!originalResponse.ok) {
            return originalResponse;
          }
          
          return new Response(originalResponse.body, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers: {
              ...Object.fromEntries([...originalResponse.headers.entries()]),
              'Content-Type': 'application/json; charset=utf-8',
              ...corsHeaders
            }
          });
        } catch (error) {
          logger.error(`Error handling JSON file: ${error.message}`, 'router');
          return fetch(request); // Fallback to original request
        }
      }
      
      // -------------------------------------------------------------------------
      // PART 3: PASS-THROUGH FOR OTHER REQUESTS
      // -------------------------------------------------------------------------
      
      // For all other requests, add appropriate content type and pass through
      try {
        logger.debug(`Pass-through request: ${url.pathname}`, 'router');
        
        const originalResponse = await fetch(request);
        
        // If response is not successful, just pass it through
        if (!originalResponse.ok) {
          return originalResponse;
        }
        
        // Determine content type based on path
        const contentType = getContentType(url.pathname);
        
        // Create a new response with the appropriate content type
        return new Response(originalResponse.body, {
          status: originalResponse.status,
          statusText: originalResponse.statusText,
          headers: {
            ...Object.fromEntries([...originalResponse.headers.entries()]),
            'Content-Type': contentType,
            ...corsHeaders
          }
        });
      } catch (error) {
        logger.error(`Error in pass-through request: ${error.message}`, 'router');
        return fetch(request); // Fallback to original request
      }
      
    } catch (error) {
      // -------------------------------------------------------------------------
      // PART 4: ERROR HANDLING
      // -------------------------------------------------------------------------
      
      // Log detailed error information
      logger.error(`Error handling request: ${error.message}`, 'router', {
        stack: error.stack,
        url: request.url,
        method: request.method
      });
      
      // Return a structured JSON error response
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Internal Server Error',
          message: error.message 
        }), 
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }
};