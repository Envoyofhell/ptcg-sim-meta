// Updated workers/src/socket/socket-handler.js
import { log } from '../utils/logging.js';

// Store active connections
const activeConnections = new Map();
const rooms = new Map();

/**
 * Socket.IO protocol constants
 */
const SOCKET_PROTOCOL = {
  CONNECT: '0',
  DISCONNECT: '1',
  EVENT: '2',
  ACK: '3',
  CONNECT_ERROR: '4',
  BINARY_EVENT: '5',
  BINARY_ACK: '6',
};

/**
 * Create Socket.IO compatible response
 * @param {string} type - Socket.IO message type
 * @param {Object} data - Message data
 * @returns {string} Formatted Socket.IO message
 */
function formatSocketResponse(type, data = {}) {
  if (type === SOCKET_PROTOCOL.CONNECT) {
    return `${type}{"sid":"${data.sid || generateId()}"}`;
  }

  if (type === SOCKET_PROTOCOL.EVENT) {
    return `${type}${JSON.stringify([data.event, ...(data.args || [])])}`;
  }

  if (
    type === SOCKET_PROTOCOL.DISCONNECT ||
    type === SOCKET_PROTOCOL.CONNECT_ERROR
  ) {
    return `${type}{"message":"${data.message || ''}"}`;
  }

  // For ping/pong
  if (type === SOCKET_PROTOCOL.CONNECT || type === SOCKET_PROTOCOL.ACK) {
    return type;
  }

  return `${type}${JSON.stringify(data)}`;
}

/**
 * Generate a random ID for Socket.IO connections
 * @returns {string} Random ID
 */
function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Parse Socket.IO message
 * @param {string} message - Socket.IO message
 * @returns {Object} Parsed message
 */
function parseSocketMessage(message) {
  try {
    // Extract type and data
    const type = message.charAt(0);
    let data = null;

    if (message.length > 1) {
      try {
        data = JSON.parse(message.substring(1));
      } catch (e) {
        log(`Error parsing Socket.IO message data: ${e.message}`, 'error');
      }
    }

    return { type, data };
  } catch (error) {
    log(`Error parsing Socket.IO message: ${error.message}`, 'error');
    return { type: '4', data: null }; // Return error type
  }
}

/**
 * Handle Socket.IO handshake
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response
 */
export async function handleSocketHandshake(request) {
  const url = new URL(request.url);
  const transport = url.searchParams.get('transport') || 'polling';
  const headers = {
    'Content-Type': 'text/plain; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Create a new session
  const sid = generateId();

  // Store connection information
  activeConnections.set(sid, {
    id: sid,
    transport,
    lastActivity: Date.now(),
    request: {
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown',
    },
  });

  log(`New Socket.IO connection: ${sid} (${transport})`, 'info');

  // Format handshake response
  const handshakeResponse = {
    sid,
    upgrades: ['websocket'],
    pingInterval: 25000,
    pingTimeout: 20000,
    maxPayload: 1000000,
  };

  return new Response(`0${JSON.stringify(handshakeResponse)}`, { headers });
}

/**
 * Handle Socket.IO polling
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response
 */
export async function handleSocketPolling(request) {
  const url = new URL(request.url);
  const sid = url.searchParams.get('sid');

  const headers = {
    'Content-Type': 'text/plain; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
  };

  // Handle session not found
  if (sid && !activeConnections.has(sid)) {
    log(`Socket.IO session not found: ${sid}`, 'warn');
    return new Response(
      formatSocketResponse(SOCKET_PROTOCOL.CONNECT_ERROR, {
        message: 'Session not found',
      }),
      { headers }
    );
  }

  // Update last activity
  if (sid) {
    const connection = activeConnections.get(sid);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  if (request.method === 'GET') {
    // Handle GET (client receiving data)
    return new Response('', { headers });
  } else if (request.method === 'POST') {
    // Handle POST (client sending data)
    try {
      const body = await request.text();
      log(`Received Socket.IO message: ${body}`, 'debug');

      const { type, data } = parseSocketMessage(body);

      // Process message based on type
      if (type === SOCKET_PROTOCOL.EVENT && Array.isArray(data)) {
        const [event, ...args] = data;
        await handleSocketEvent(sid, event, args);
      }

      // Acknowledge receipt
      return new Response(SOCKET_PROTOCOL.ACK, { headers });
    } catch (error) {
      log(`Error processing Socket.IO message: ${error.message}`, 'error');
      return new Response(
        formatSocketResponse(SOCKET_PROTOCOL.CONNECT_ERROR, {
          message: 'Error processing message',
        }),
        { headers }
      );
    }
  }

  return new Response('Method not allowed', { status: 405, headers });
}

/**
 * Handle Socket.IO events
 * @param {string} sid - Socket ID
 * @param {string} event - Event name
 * @param {Array} args - Event arguments
 */
async function handleSocketEvent(sid, event, args) {
  log(`Socket.IO event: ${event} from ${sid}`, 'debug');

  // Update last activity
  const connection = activeConnections.get(sid);
  if (connection) {
    connection.lastActivity = Date.now();
  }

  // Handle different events
  switch (event) {
    case 'joinGame':
      await handleJoinGame(sid, args[0], args[1], args[2]);
      break;
    case 'leaveRoom':
      await handleLeaveRoom(sid, args[0]);
      break;
    case 'storeGameState':
      await handleStoreGameState(sid, args[0]);
      break;
    // Add other event handlers as needed
    default:
      log(`Unhandled Socket.IO event: ${event}`, 'warn');
  }
}

/**
 * Handle join game event
 * @param {string} sid - Socket ID
 * @param {string} roomId - Room ID
 * @param {string} username - User's username
 * @param {boolean} isSpectator - Whether user is a spectator
 */
async function handleJoinGame(sid, roomId, username, isSpectator) {
  if (!roomId) {
    log(`Invalid room ID for join game: ${roomId}`, 'warn');
    return;
  }

  // Create room if it doesn't exist
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      players: [],
      spectators: [],
      gameState: null,
      lastActivity: Date.now(),
    });
  }

  const room = rooms.get(roomId);

  // Check if room is full
  if (!isSpectator && room.players.length >= 2) {
    log(`Room ${roomId} is full, rejecting join request`, 'warn');
    // Send roomReject event to client
    return;
  }

  // Add user to room
  if (isSpectator) {
    room.spectators.push({ sid, username });
  } else {
    room.players.push({ sid, username });
  }

  log(
    `User ${username} joined room ${roomId} as ${isSpectator ? 'spectator' : 'player'}`,
    'info'
  );

  // Update room activity
  room.lastActivity = Date.now();
}

/**
 * Handle leave room event
 * @param {string} sid - Socket ID
 * @param {Object} data - Leave room data
 */
async function handleLeaveRoom(sid, data) {
  const { roomId, username, isSpectator } = data;

  if (!roomId || !rooms.has(roomId)) {
    log(`Invalid room ID for leave room: ${roomId}`, 'warn');
    return;
  }

  const room = rooms.get(roomId);

  // Remove user from room
  if (isSpectator) {
    room.spectators = room.spectators.filter(
      (spectator) => spectator.sid !== sid
    );
  } else {
    room.players = room.players.filter((player) => player.sid !== sid);
  }

  log(`User ${username} left room ${roomId}`, 'info');

  // Clean up empty rooms
  if (room.players.length === 0 && room.spectators.length === 0) {
    rooms.delete(roomId);
    log(`Room ${roomId} deleted (empty)`, 'info');
  }
}

/**
 * Handle store game state event
 * @param {string} sid - Socket ID
 * @param {Object} gameState - Game state data
 */
async function handleStoreGameState(sid, gameState) {
  try {
    // Import game state functions
    const { storeGameState } = await import('../db/game-state.js');
    const { generateRandomKey } = await import('../utils/key-generator.js');

    // Generate a unique key
    const key = generateRandomKey(4);

    // Store game state
    const result = await storeGameState(
      key,
      typeof gameState === 'string' ? gameState : JSON.stringify(gameState)
    );

    log(
      `Game state stored with key ${key} (${result.size_bytes} bytes)`,
      'info'
    );

    // Send success response to client
    // This would be handled by your Socket.IO implementation
  } catch (error) {
    log(`Error storing game state: ${error.message}`, 'error');

    // Send error response to client
    // This would be handled by your Socket.IO implementation
  }
}

/**
 * Clean up inactive connections
 * Called periodically
 */
export function cleanupInactiveConnections() {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes

  // Clean up inactive connections
  for (const [sid, connection] of activeConnections.entries()) {
    if (now - connection.lastActivity > timeout) {
      activeConnections.delete(sid);
      log(`Cleaned up inactive connection: ${sid}`, 'info');
    }
  }

  // Clean up inactive rooms
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActivity > timeout) {
      rooms.delete(roomId);
      log(`Cleaned up inactive room: ${roomId}`, 'info');
    }
  }
}
