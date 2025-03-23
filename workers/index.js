// File: workers/index.js
/**
 * PTCG-Sim-Meta Cloudflare Worker
 * 
 * Enhanced with Socket.IO compatibility layer for real-time communication
 */
import { Router } from 'itty-router';
import { corsHeaders, handleOptions, getExpandedCorsHeaders } from './src/utils/cors';
import { log, setDebugMode } from './src/utils/logging';
import * as gameStateApi from './src/api/game-state';
import * as healthApi from './src/api/health';

// Enable debug mode in development
setDebugMode(true);

// Simple in-memory session store for Socket.IO connections
const sessions = new Map();
const rooms = new Map();

/**
 * Generate a Socket.IO handshake response
 * This provides a minimal implementation of the Socket.IO protocol
 */
function generateSocketResponse(type, data = {}) {
  // Socket.IO protocol: <packet type><data>
  // 0: connect, 40: connect with namespace, 2: ping, 3: pong, 4: message, etc.
  return `${type}${type !== '2' && type !== '3' ? JSON.stringify(data) : ''}`;
}

/**
 * Handle Socket.IO polling requests
 * Provides a minimal implementation to handle long-polling
 */
async function handleSocketIO(request) {
  const url = new URL(request.url);
  const headers = getExpandedCorsHeaders(request);
  
  // For HTTP long-polling
  if (request.method === 'GET') {
    // Simple polling response (mimics Socket.IO heartbeat)
    return new Response('2', {
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        ...headers
      }
    });
  } else if (request.method === 'POST') {
    // Handle client messages
    try {
      const body = await request.text();
      log(`Received client message: ${body}`, 'debug');
      
      // Respond with acknowledgement
      return new Response('3', {
        headers: {
          'Content-Type': 'text/plain; charset=UTF-8',
          ...headers
        }
      });
    } catch (error) {
      log(`Error processing message: ${error.message}`, 'error');
      return new Response('Error processing message', { 
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
          ...headers
        }
      });
    }
  }
  
  return new Response('Unsupported method', { 
    status: 405,
    headers: {
      'Content-Type': 'text/plain',
      ...headers
    }
  });
}

// Create a new router
const router = Router();

// Root path handler - provides basic Worker health information
router.get('/', () => {
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'PTCG-Sim-Meta Worker is running',
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

// Socket.IO compatibility endpoints
router.get('/socket.io/*', handleSocketIO);
router.post('/socket.io/*', handleSocketIO);

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
      // Store environment in the request for handlers to access
      request.env = env;
      
      // Log the request
      const url = new URL(request.url);
      log(`${request.method} ${url.pathname}${url.search}`, 'info');
      
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