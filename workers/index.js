// workers/index.js
/**
 * Main Cloudflare Worker entry point
 *
 * Handles HTTP requests, WebSocket upgrades, and routes to appropriate handlers.
 */

import { Router } from 'itty-router';
import { handleApiRequests } from './api.js';
import { GameRoom } from './game-room.js';

// List of allowed origins
const ALLOWED_ORIGINS = [
  'https://test.meta-ptcg.org',
  'https://meta-ptcg.org',
  'https://test-ptcg-sim-meta.pages.dev',
  'https://ptcg-sim-meta.pages.dev',
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
];

// Create a router
const router = Router();

// API routes
router.get('/api/importData', (request, env) =>
  handleApiRequests(request, env)
);

// Function to check if origin is allowed
function isAllowedOrigin(origin) {
  return (
    !origin ||
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith('.workers.dev') ||
    origin.endsWith('.pages.dev')
  );
}

// Set CORS headers for a response
function setCorsHeaders(response, request) {
  const origin = request.headers.get('Origin');
  if (isAllowedOrigin(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  return response;
}

// Main worker handlers
export default {
  // HTTP request handler
  async fetch(request, env, ctx) {
    console.log(`Request: ${request.method} ${new URL(request.url).pathname}`);
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
          },
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
      console.log(`Processing API request: ${url.pathname}`);
      try {
        const response = await router.handle(request, env);
        if (response) {
          return setCorsHeaders(response, request);
        }
      } catch (error) {
        console.error(`Error handling API request: ${error.message}`);
        return setCorsHeaders(
          new Response(
            JSON.stringify({
              error: 'Internal server error',
              message: error.message,
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          ),
          request
        );
      }
    }

    // Special handling for import page
    if (url.pathname === '/import') {
      try {
        // Return the import.html page
        const response = await env.ASSETS.fetch(
          new Request(`${url.origin}/import.html`, request)
        );
        return setCorsHeaders(response, request);
      } catch (error) {
        console.error(`Error serving import page: ${error.message}`);
      }
    }

    // Serve static files from the site
    try {
      console.log(`Serving static asset: ${url.pathname}`);
      const assetRequest = new Request(request.url, request);

      // Add cache headers for static assets
      const response = await env.ASSETS.fetch(assetRequest);

      // Add cache control headers based on file type
      const cacheControl = url.pathname.match(
        /\.(js|css|jpg|jpeg|png|gif|svg|webp)$/
      )
        ? 'public, max-age=86400' // 1 day for static assets
        : 'public, max-age=3600'; // 1 hour for HTML and other files

      return setCorsHeaders(
        new Response(response.body, {
          status: response.status,
          headers: {
            ...Object.fromEntries(response.headers),
            'Cache-Control': cacheControl,
          },
        }),
        request
      );
    } catch (e) {
      console.error(`Error serving static asset: ${e.message}`);

      // Try serving index.html for all routes as a fallback (for SPA)
      try {
        const indexResponse = await env.ASSETS.fetch(
          new Request(`${url.origin}/index.html`, request)
        );
        return setCorsHeaders(
          new Response(indexResponse.body, {
            status: 200,
            headers: {
              ...Object.fromEntries(indexResponse.headers),
              'Cache-Control': 'public, max-age=3600',
              'Content-Type': 'text/html',
            },
          }),
          request
        );
      } catch (indexError) {
        // If we can't serve index.html either, return 404
        return setCorsHeaders(
          new Response('Not found', {
            status: 404,
            headers: {
              'Content-Type': 'text/plain',
            },
          }),
          request
        );
      }
    }
  },

  // Scheduled tasks handler (for cron jobs)
  async scheduled(event, env, ctx) {
    console.log('Running scheduled task:', event.cron);

    // Could implement database cleanups, inactive room purging, etc.
  },
};

/**
 * Handle WebSocket connection upgrade
 */
async function handleWebSocket(request, env) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId') || crypto.randomUUID();
  const origin = request.headers.get('Origin');

  // Check if origin is allowed
  if (!isAllowedOrigin(origin)) {
    return new Response('Forbidden origin', { status: 403 });
  }

  console.log(`WebSocket connection request for room: ${roomId}`);

  try {
    // Get Durable Object for this room
    const id = env.GAME_ROOM.idFromName(roomId);
    const room = env.GAME_ROOM.get(id);

    // Forward request to the Durable Object
    const response = await room.fetch(request);

    // Add CORS headers
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, OPTIONS'
      );
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    return response;
  } catch (error) {
    console.error(`Error handling WebSocket connection: ${error.message}`);
    return new Response(`WebSocket connection error: ${error.message}`, {
      status: 500,
    });
  }
}

// Export the Durable Object class
export { GameRoom };
