// workers/index.js
// Main entry point for the Cloudflare Worker
import { Router } from 'itty-router';
import { handleApiRequests } from './api.js';
import { GameRoom } from './game-room.js';

// Create a router for handling HTTP requests
const router = Router();

// API routes
router.get('/api/importData', handleApiRequests);
router.all('*', (request) => new Response('404 Not Found', { status: 404 }));

// Main worker handlers
export default {
  // HTTP request handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Check if this is a WebSocket upgrade request
    if (request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request, env);
    }
    
    // Handle API requests
    if (url.pathname.startsWith('/api/')) {
      return router.handle(request, env);
    }
    
    // Otherwise serve static assets from Cloudflare Pages
    return env.ASSETS.fetch(request);
  }
};

// WebSocket connection handler
async function handleWebSocket(request, env) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId') || crypto.randomUUID();
  
  // Get Durable Object for this room
  const id = env.GAME_ROOM.idFromName(roomId);
  const room = env.GAME_ROOM.get(id);
  
  // Forward request to the Durable Object
  return room.fetch(request);
}

// Export the Durable Object class
export { GameRoom };