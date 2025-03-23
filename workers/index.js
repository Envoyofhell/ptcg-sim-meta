/**
 * PTCG-Sim-Meta Worker Entry Point
 * 
 * This is the main entry file for the Cloudflare Worker that handles
 * API requests and ensures proper MIME types for static files.
 */

import { Router } from 'itty-router';
import { corsHeaders, handleOptions } from './src/utils/cors.js';

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

// Catch-all for any unrecognized API routes
router.all('/api/*', () => new Response('API endpoint not found', { status: 404 }));

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
      
      // Parse the URL from the request
      const url = new URL(request.url);
      
      // Log requests in debug mode
      if (env.LOG_LEVEL === 'debug') {
        console.log(`${request.method} ${url.pathname}`);
      }
      
      // -------------------------------------------------------------------------
      // PART 1: API REQUEST HANDLING
      // -------------------------------------------------------------------------
      
      // For API requests, use the router
      if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
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
      
      // For JavaScript files, ensure correct MIME type
      if (
        url.pathname.endsWith('.js') || 
        url.pathname.endsWith('.mjs') ||
        url.pathname.includes('.module.js')
      ) {
        try {
          // Fetch the original resource
          const originalResponse = await fetch(request);
          
          // Check if the response was successful
          if (!originalResponse.ok) {
            return originalResponse; // Pass through error responses
          }
          
          // Create a new response with the correct MIME type
          return new Response(originalResponse.body, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers: {
              ...Object.fromEntries([...originalResponse.headers.entries()]),
              'Content-Type': 'application/javascript; charset=utf-8'
            }
          });
        } catch (error) {
          console.error(`Error handling JavaScript file: ${error.message}`);
          return fetch(request); // Fallback to original request
        }
      }
      
      // For CSS files, ensure correct MIME type
      if (url.pathname.endsWith('.css')) {
        try {
          const originalResponse = await fetch(request);
          
          if (!originalResponse.ok) {
            return originalResponse;
          }
          
          return new Response(originalResponse.body, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers: {
              ...Object.fromEntries([...originalResponse.headers.entries()]),
              'Content-Type': 'text/css; charset=utf-8'
            }
          });
        } catch (error) {
          console.error(`Error handling CSS file: ${error.message}`);
          return fetch(request); // Fallback to original request
        }
      }
      
      // For JSON and map files, ensure correct MIME type
      if (url.pathname.endsWith('.json') || url.pathname.endsWith('.map')) {
        try {
          const originalResponse = await fetch(request);
          
          if (!originalResponse.ok) {
            return originalResponse;
          }
          
          return new Response(originalResponse.body, {
            status: originalResponse.status,
            statusText: originalResponse.statusText,
            headers: {
              ...Object.fromEntries([...originalResponse.headers.entries()]),
              'Content-Type': 'application/json; charset=utf-8'
            }
          });
        } catch (error) {
          console.error(`Error handling JSON file: ${error.message}`);
          return fetch(request); // Fallback to original request
        }
      }
      
      // -------------------------------------------------------------------------
      // PART 3: PASS-THROUGH FOR OTHER REQUESTS
      // -------------------------------------------------------------------------
      
      // For all other requests, pass through to the origin
      return fetch(request);
    } catch (error) {
      // -------------------------------------------------------------------------
      // PART 4: ERROR HANDLING
      // -------------------------------------------------------------------------
      
      // Log detailed error information
      console.error(`Error handling request: ${error.message}`);
      if (error.stack) {
        console.error(`Stack trace: ${error.stack}`);
      }
      
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
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        }
      );
    }
  }
};