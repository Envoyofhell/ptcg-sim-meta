// workers/index.js
import { Router } from 'itty-router';
import { handleApiRequests } from './api.js';
import { GameRoom } from './game-room.js';

// Create a router
const router = Router();

// API routes
router.get('/api/importData', handleApiRequests);

// Main router handler
export default {
  async fetch(request, env, ctx) {
    try {
      // Try API routes first
      const apiResponse = await router.handle(request, env);
      if (apiResponse) return apiResponse;
      
      // If not an API route, serve static files from Pages
      return env.ASSETS.fetch(request);
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
  // Durable Object binding for WebSocket connections
  async websocket(message, env, context) {
    // Route WebSocket messages to appropriate Durable Object instances
    const url = new URL(context.request.url);
    // Use existing room ID from URL params or generate a new one
    const roomId = url.searchParams.get('roomId') || crypto.randomUUID();
    
    // Get or create a Game Room Durable Object
    const roomObject = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId));
    
    // Forward the message to the appropriate Durable Object
    return roomObject.fetch(context.request.url, {
      method: 'POST',
      body: JSON.stringify(message)
    });
  }
};

// Export Durable Object class
export { GameRoom };