/**
 * PTCG-Sim-Meta Cloudflare Worker
 * 
 * Main entry point that routes requests to the appropriate handlers
 * and provides CORS middleware for cross-origin requests.
 */
import { Router } from 'itty-router';
import { corsHeaders, handleOptions } from './utils/cors';
import { log } from './utils/logging';
import * as gameStateApi from './api/game-state';
import * as healthApi from './api/health';

// Create a new router
const router = Router();

// CORS preflight handler
router.options('*', handleOptions);

// Health check routes
router.get('/health', healthApi.getHealth);
router.get('/api/health', healthApi.getHealth);

// Game state API routes
router.get('/api/importData', gameStateApi.getGameState);
router.post('/api/storeGameState', gameStateApi.storeGameState);
router.delete('/api/gameState/:key', gameStateApi.deleteGameState);
router.get('/api/stats', gameStateApi.getStats);

// Catch-all 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

// Main fetch handler
export default {
  async fetch(request, env, ctx) {
    try {
      // Store environment in the request for handlers to access
      request.env = env;
      
      // Log the request
      log(`${request.method} ${new URL(request.url).pathname}`, 'info');
      
      // Route the request
      const response = await router.handle(request);
      
      // Add CORS headers to all responses
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    } catch (error) {
      // Log error and return a 500 response
      log(`Error handling request: ${error.message}`, 'error');
      log(`Stack trace: ${error.stack}`, 'debug');
      
      const errorResponse = new Response(
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
      
      return errorResponse;
    }
  },
};