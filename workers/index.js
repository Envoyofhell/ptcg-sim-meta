// workers/index.js
import { Router } from 'itty-router';
import { handleApiRequests } from './api.js';
import { GameRoom } from './game-room.js';

// List of allowed origins
const ALLOWED_ORIGINS = [
  'https://test.meta-ptcg.org',
  'https://test-ptcg-sim-meta.pages.dev',
  'https://meta-ptcg.org',
  'https://ptcg-sim-meta.pages.dev',
  // Include development origins too if needed
  'http://localhost:3000',
  'http://localhost:8787'
];

// Create a router
const router = Router();

// API routes
router.get('/api/importData', handleApiRequests);

// Function to check if origin is allowed
function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.workers.dev');
}

// Set CORS headers for a response
function setCorsHeaders(response, request) {
  const origin = request.headers.get('Origin');
  if (isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return response;
}

// Main worker handlers
export default {
  // HTTP request handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      if (isAllowedOrigin(origin)) {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
          }
        });
      }
      return new Response(null, { status: 204 });
    }
    
    // Handle WebSocket upgrade requests
    if (request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request, env);
    }
    
    // Handle API requests through the router
    if (url.pathname.startsWith('/api/')) {
      let response = await router.handle(request, env);
      if (response) {
        return setCorsHeaders(response, request);
      }
    }
    
    // Serve static files from the site
    try {
      // Add a cache control header for static assets
      const response = await env.ASSETS.fetch(request);
      
      // Return the response with cache control headers
      return setCorsHeaders(new Response(response.body, {
        status: response.status,
        headers: {
          ...Object.fromEntries(response.headers),
          'Cache-Control': 'public, max-age=3600',
        },
      }), request);
    } catch (e) {
      return setCorsHeaders(new Response('Not found', { status: 404 }), request);
    }
  }
};

// WebSocket connection handler
async function handleWebSocket(request, env) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId') || crypto.randomUUID();
  const origin = request.headers.get('Origin');
  
  // Check if origin is allowed
  if (!isAllowedOrigin(origin)) {
    return new Response('Forbidden', { status: 403 });
  }
  
  // Get Durable Object for this room
  const id = env.GAME_ROOM.idFromName(roomId);
  const room = env.GAME_ROOM.get(id);
  
  // Forward request to the Durable Object
  const response = await room.fetch(request);
  
  // Add CORS headers
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return response;
}

// Export the Durable Object class
export { GameRoom };