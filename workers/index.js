// Updated workers/index.js
import { Router } from 'itty-router';
import { corsHeaders, handleOptions } from './src/utils/cors';
import { log, setDebugMode } from './src/utils/logging';
import * as gameStateApi from './src/api/game-state';
import * as healthApi from './src/api/health';
import { handleSocketHandshake, handleSocketPolling, cleanupInactiveConnections } from './src/socket/socket-handler';

// Enable debug mode in development environment
setDebugMode(true);

// Create router
const router = Router();

// Root path handler
router.get('/', () => {
  return new Response(JSON.stringify({
    status: 'ok',
    name: 'PTCG-Sim-Meta Worker',
    version: '1.5.1',
    timestamp: new Date().toISOString()
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
});

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

// Socket.IO compatibility routes
router.get('/socket.io/', handleSocketHandshake);
router.get('/socket.io/*', handleSocketPolling);
router.post('/socket.io/*', handleSocketPolling);

// Catch-all 404 handler
router.all('*', (request) => {
  const url = new URL(request.url);
  log(`404 Not Found: ${url.pathname}${url.search}`, 'warn');
  
  return new Response('Not Found', { 
    status: 404,
    headers: {
      'Content-Type': 'text/plain',
      ...corsHeaders
    }
  });
});

// Main fetch handler
export default {
  async fetch(request, env, ctx) {
    try {
      // Store environment in request for handlers to access
      request.env = env;
      
      // Log request
      const url = new URL(request.url);
      log(`${request.method} ${url.pathname}${url.search}`, 'info');
      
      // Process request
      const response = await router.handle(request);
      
      // Add CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    } catch (error) {
      // Log error
      log(`Error handling request: ${error.message}`, 'error');
      log(`Stack trace: ${error.stack}`, 'debug');
      
      // Return error response
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
  },
  
  // Scheduled task to clean up inactive connections
  async scheduled(event, env, ctx) {
    try {
      log(`Running scheduled task: ${event.cron}`, 'info');
      cleanupInactiveConnections();
    } catch (error) {
      log(`Error in scheduled task: ${error.message}`, 'error');
    }
  }
};