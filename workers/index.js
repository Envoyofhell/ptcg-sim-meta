// workers/index.js
import { Router } from 'itty-router';
import { handleApiRequests } from './api.js';
import { GameRoom } from './game-room.js';

// Create a router
const router = Router();

// API routes
router.get('/api/importData', handleApiRequests);

// Main worker handlers
export default {
  // HTTP request handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle WebSocket upgrade requests
    if (request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request, env);
    }
    
    // Handle API requests through the router
    if (url.pathname.startsWith('/api/')) {
      const response = await router.handle(request, env);
      if (response) return response;
    }
    
    // Serve static files from the site
    try {
      // Add a cache control header for static assets
      const response = await env.ASSETS.fetch(request);
      
      // Return the response with cache control headers
      return new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
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