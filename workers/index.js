/**
 * PTCG-Sim-Meta Cloudflare Worker
 * 
 * Enhanced with Socket.IO compatibility layer and WebSocket support
 * for real-time communication between clients.
 */
import { Router } from 'itty-router';
import { corsHeaders, handleOptions, getExpandedCorsHeaders } from './src/utils/cors';
import { log, setDebugMode } from './src/utils/logging';
import * as gameStateApi from './src/api/game-state';
import * as healthApi from './src/api/health';

// Enable debug mode in development environments
setDebugMode(true);

// In-memory session store for Socket.IO connections
// Note: This will reset on worker restarts, but provides basic functionality
const sessions = new Map();
const rooms = new Map();

// Socket.IO protocol constants
const SOCKET_IO_VERSION = '4';  // EIO=4 from client requests
const SOCKET_IO_PING_INTERVAL = 25000;
const SOCKET_IO_PING_TIMEOUT = 20000;

/**
 * Generate a Socket.IO handshake response
 * This mimics the initial Socket.IO handshake protocol
 * 
 * @param {string} sid - Session ID
 * @returns {string} Socket.IO handshake response
 */
function generateHandshake(sid) {
  const handshake = {
    sid: sid,
    upgrades: ['websocket'],
    pingInterval: SOCKET_IO_PING_INTERVAL,
    pingTimeout: SOCKET_IO_PING_TIMEOUT,
    maxPayload: 1000000
  };
  
  // Socket.IO protocol format: <packet type><data>
  // 0 = handshake
  return `0${JSON.stringify(handshake)}`;
}

/**
 * Handle a Socket.IO HTTP long-polling request
 * 
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response
 */
async function handleSocketIO(request) {
  const url = new URL(request.url);
  const transport = url.searchParams.get('transport') || 'polling';
  
  // Generate a session ID if not exists
  let sid = url.searchParams.get('sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessions.set(sid, {
      created: Date.now(),
      lastPing: Date.now(),
      transport: transport
    });
    log(`Created new Socket.IO session: ${sid}`, 'info');
    
    // Return the handshake packet
    return new Response(generateHandshake(sid), {
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        ...getExpandedCorsHeaders(request)
      }
    });
  }
  
  // Update existing session
  const session = sessions.get(sid);
  if (session) {
    session.lastPing = Date.now();
    
    // Handle different packet types
    if (request.method === 'POST') {
      const body = await request.text();
      
      // Client messages usually start with "42" in Socket.IO v4
      if (body.startsWith('42')) {
        try {
          // Extract the actual message (format: 42["event",{data}])
          const messageJson = body.substring(2);
          const message = JSON.parse(messageJson);
          
          // Process the message
          log(`Received Socket.IO message: ${messageJson}`, 'debug');
          
          // Handle specific events
          if (message[0] === 'joinGame' && message.length >= 3) {
            const roomId = message[1];
            const username = message[2];
            const isSpectator = message.length > 3 ? message[3] : false;
            
            // Join room logic
            if (!rooms.has(roomId)) {
              rooms.set(roomId, { 
                players: new Set(), 
                spectators: new Set() 
              });
            }
            
            const room = rooms.get(roomId);
            if (isSpectator) {
              room.spectators.add(username);
              // Send spectatorJoin event
              return new Response('3', { // '3' is the empty acknowledgment
                headers: {
                  'Content-Type': 'text/plain; charset=UTF-8',
                  ...getExpandedCorsHeaders(request)
                }
              });
            } else if (room.players.size < 2) {
              room.players.add(username);
              // Send joinGame event
              return new Response('3', {
                headers: {
                  'Content-Type': 'text/plain; charset=UTF-8',
                  ...getExpandedCorsHeaders(request)
                }
              });
            } else {
              // Room is full
              return new Response('42["roomReject"]', {
                headers: {
                  'Content-Type': 'text/plain; charset=UTF-8',
                  ...getExpandedCorsHeaders(request)
                }
              });
            }
          }
          
          // Handle heartbeat
          if (message[0] === 'heartbeat') {
            return new Response('42["heartbeat-response"]', {
              headers: {
                'Content-Type': 'text/plain; charset=UTF-8',
                ...getExpandedCorsHeaders(request)
              }
            });
          }
        } catch (error) {
          log(`Error processing Socket.IO message: ${error.message}`, 'error');
        }
      }
      
      // Default response for POST requests
      return new Response('ok', {
        headers: {
          'Content-Type': 'text/plain; charset=UTF-8',
          ...getExpandedCorsHeaders(request)
        }
      });
    }
    
    // For GET requests, send a ping packet (2)
    return new Response('2', {
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        ...getExpandedCorsHeaders(request)
      }
    });
  }
  
  // Session not found
  return new Response('Invalid session', {
    status: 400,
    headers: {
      'Content-Type': 'text/plain; charset=UTF-8',
      ...getExpandedCorsHeaders(request)
    }
  });
}

/**
 * Handle WebSocket connections for Socket.IO
 * 
 * @param {Request} request - HTTP request for WebSocket upgrade
 * @param {Object} env - Environment variables
 * @param {Object} ctx - Execution context
 * @returns {Response} WebSocket response
 */
async function handleWebSocket(request, env, ctx) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }
  
  const url = new URL(request.url);
  const sid = url.searchParams.get('sid');
  
  // Require a valid session ID for WebSocket upgrades
  if (!sid || !sessions.has(sid)) {
    return new Response('Invalid session', { status: 400 });
  }
  
  // Update session transport
  const session = sessions.get(sid);
  session.transport = 'websocket';
  
  const webSocketPair = new WebSocketPair();
  const client = webSocketPair[0];
  const server = webSocketPair[1];
  
  server.accept();
  
  // Initial Socket.IO WebSocket packet
  server.send('40'); // Socket.IO connect packet
  
  // Set up WebSocket event handlers
  server.addEventListener('message', (event) => {
    try {
      // Update last ping time
      session.lastPing = Date.now();
      
      const message = event.data;
      log(`WebSocket message received: ${message}`, 'debug');
      
      // Handle ping messages (Socket.IO protocol)
      if (message === '2') {
        server.send('3'); // Pong
        return;
      }
      
      // Handle actual Socket.IO messages (42["event",data])
      if (message.startsWith('42')) {
        try {
          const messageJson = message.substring(2);
          const parsedMessage = JSON.parse(messageJson);
          
          // Process message here
          log(`Processed WebSocket message: ${messageJson}`, 'debug');
          
          // Echo back the message for now (real implementation would process it)
          server.send(message);
        } catch (error) {
          log(`Error parsing WebSocket message: ${error.message}`, 'error');
        }
      }
    } catch (error) {
      log(`WebSocket error: ${error.message}`, 'error');
    }
  });
  
  server.addEventListener('close', (event) => {
    log(`WebSocket closed for session ${sid}: ${event.code}`, 'info');
    // Don't remove the session yet, allow reconnection
  });
  
  server.addEventListener('error', (event) => {
    log(`WebSocket error for session ${sid}`, 'error');
  });
  
  // Save the WebSocket in the session
  session.webSocket = server;
  
  // Return the client end of the WebSocket
  return new Response(null, {
    status: 101,
    webSocket: client
  });
}

// Create a new router
const router = Router();

// Root path handler
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

// Add Socket.IO route handlers
router.get('/socket.io/*', (request) => handleSocketIO(request));
router.post('/socket.io/*', (request) => handleSocketIO(request));

// Catch-all 404 handler
router.all('*', (request) => {
  const url = new URL(request.url);
  log(`404 Not Found: ${url.pathname}`, 'warn');
  
  return new Response('Not Found', { 
    status: 404,
    headers: {
      'Content-Type': 'text/plain',
      ...corsHeaders
    }
  });
});

// Periodic cleanup function to remove old sessions
function cleanupSessions() {
  const now = Date.now();
  const expiredSessions = [];
  
  sessions.forEach((session, sid) => {
    // Remove sessions that haven't had activity for > 30 seconds
    if (now - session.lastPing > 30000) {
      expiredSessions.push(sid);
    }
  });
  
  expiredSessions.forEach(sid => {
    sessions.delete(sid);
  });
  
  if (expiredSessions.length > 0) {
    log(`Cleaned up ${expiredSessions.length} expired sessions`, 'info');
  }
}

// Main fetch handler
export default {
  async fetch(request, env, ctx) {
    try {
      // Store environment in the request for handlers to access
      request.env = env;
      
      // Check for WebSocket upgrade requests
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader === 'websocket') {
        return handleWebSocket(request, env, ctx);
      }
      
      // Log the request
      const url = new URL(request.url);
      log(`${request.method} ${url.pathname}${url.search}`, 'info');
      
      // Run cleanup occasionally
      if (Math.random() < 0.05) { // ~5% of requests trigger cleanup
        cleanupSessions();
      }
      
      // Route the request
      const response = await router.handle(request);
      
      // Add CORS headers to all responses
      const expandedHeaders = getExpandedCorsHeaders(request);
      Object.entries(expandedHeaders).forEach(([key, value]) => {
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
            ...getExpandedCorsHeaders(request)
          }
        }
      );
    }
  },
  
  // Add scheduled functionality if needed
  async scheduled(event, env, ctx) {
    // Perform maintenance tasks here
    cleanupSessions();
  }
};