// workers/game-room.js
/**
 * GameRoom Durable Object
 *
 * Handles real-time WebSocket connections for multiplayer games.
 * Manages room state, players, spectators, and message broadcasting.
 */

import { storeGameState, generateRandomKey } from './gamestate.js';

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.roomInfo = {
      players: new Map(),
      spectators: new Map(),
      actionData: [],
      counter: 0,
    };

    // Load persistent room state
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('roomInfo');
      if (stored) {
        this.roomInfo = stored;
        console.log(
          `Room state loaded with ${this.roomInfo.players.size} players and ${this.roomInfo.spectators.size} spectators`
        );
      }
    });
  }

  /**
   * Handle fetch requests to this Durable Object
   */
  async fetch(request) {
    // Handle WebSocket upgrades
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // Handle any HTTP requests (currently just returning 404)
    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle WebSocket connection upgrade
   */
  async handleWebSocketUpgrade(request) {
    // Extract query parameters from request URL
    const url = new URL(request.url);
    const roomId = url.searchParams.get('roomId');

    if (!roomId) {
      return new Response('Room ID is required', { status: 400 });
    }

    // Create a WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    server.accept();

    // Generate a unique session ID
    const sessionId = generateRandomKey(16);

    // Set up the WebSocket session
    this.setupWebSocketSession(sessionId, server, roomId);

    // Return the client end of the WebSocket to the browser
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Set up WebSocket session and event handlers
   */
  setupWebSocketSession(sessionId, webSocket, roomId) {
    // Create the session
    const session = {
      id: sessionId,
      webSocket,
      roomId,
      username: null,
      isPlayer: false,
      isSpectator: false,
      lastActive: Date.now(),
    };

    // Store the session
    this.sessions.set(sessionId, session);

    // Set up message handler
    webSocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        await this.handleWebSocketMessage(sessionId, message);
        session.lastActive = Date.now();
      } catch (error) {
        console.error(`Error handling WebSocket message: ${error.message}`);
        webSocket.send(
          JSON.stringify({
            type: 'error',
            message: 'Failed to process message',
            details: error.message,
          })
        );
      }
    });

    // Set up close handler
    webSocket.addEventListener('close', async () => {
      // Handle player disconnection
      await this.handleDisconnection(sessionId);
    });

    // Set up error handler
    webSocket.addEventListener('error', async (error) => {
      console.error(`WebSocket error in session ${sessionId}: ${error}`);
      await this.handleDisconnection(sessionId);
    });

    // Send initial connection confirmation
    webSocket.send(
      JSON.stringify({
        type: 'connection_established',
        sessionId,
        roomId,
      })
    );

    // Schedule session cleanup if inactive
    this.scheduleInactiveSessionCleanup();
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleWebSocketMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Extract the message type
    const { type, ...data } = message;

    // Handle different message types
    switch (type) {
      case 'joinGame':
        await this.handleJoinGame(sessionId, data);
        break;

      case 'storeGameState':
        await this.handleStoreGameState(sessionId, data);
        break;

      case 'leaveRoom':
        await this.handleLeaveRoom(sessionId, data);
        break;

      case 'pushAction':
      case 'requestAction':
        // Track game actions for later synchronization
        if (type === 'pushAction' && data.action) {
          this.roomInfo.counter = data.counter || this.roomInfo.counter + 1;
          this.roomInfo.actionData.push({
            user: data.user || 'self',
            action: data.action,
            parameters: data.parameters || [],
            counter: this.roomInfo.counter,
          });

          // Limit action history to prevent excessive storage
          if (this.roomInfo.actionData.length > 1000) {
            this.roomInfo.actionData = this.roomInfo.actionData.slice(-500);
          }

          // Update persistent storage
          await this.state.storage.put('roomInfo', this.roomInfo);
        }
        // Broadcast message to all other clients in the room
        this.broadcast(sessionId, message);
        break;

      case 'syncCheck':
      case 'resyncActions':
        await this.handleSyncRequest(sessionId, data);
        break;

      case 'spectatorActionData':
        // Don't store these large messages, just broadcast
        this.broadcast(sessionId, message);
        break;

      default:
        // For all other message types, just broadcast to other clients
        this.broadcast(sessionId, message);
        break;
    }
  }

  /**
   * Handle join game request
   */
  async handleJoinGame(sessionId, data) {
    const session = this.sessions.get(sessionId);
    const { username, isSpectator } = data;

    if (!username) {
      session.webSocket.send(
        JSON.stringify({
          type: 'error',
          message: 'Username is required',
        })
      );
      return;
    }

    session.username = username;

    // Handle spectator joining
    if (isSpectator) {
      session.isSpectator = true;
      this.roomInfo.spectators.set(username, sessionId);
      session.webSocket.send(JSON.stringify({ type: 'spectatorJoin' }));

      // Broadcast to others that a spectator joined
      this.broadcast(sessionId, {
        type: 'appendMessage',
        user: '',
        message: `${username} joined as spectator`,
        messageType: 'announcement',
      });
    }
    // Handle player joining
    else {
      if (this.roomInfo.players.size < 2) {
        session.isPlayer = true;
        this.roomInfo.players.set(username, sessionId);
        session.webSocket.send(JSON.stringify({ type: 'joinGame' }));

        // Broadcast to others that a player joined
        this.broadcast(sessionId, {
          type: 'userReconnected',
          username: username,
        });
      } else {
        session.webSocket.send(JSON.stringify({ type: 'roomReject' }));
      }
    }

    // Save updated room info
    await this.state.storage.put('roomInfo', this.roomInfo);
  }

  /**
   * Handle storing game state in D1 database
   */
  async handleStoreGameState(sessionId, data) {
    const session = this.sessions.get(sessionId);

    try {
      const key = generateRandomKey(4);
      const success = await storeGameState(this.env, key, data);

      if (success) {
        session.webSocket.send(
          JSON.stringify({
            type: 'exportGameStateSuccessful',
            key,
          })
        );
      } else {
        session.webSocket.send(
          JSON.stringify({
            type: 'exportGameStateFailed',
            message:
              'Error exporting game! Please try again or save as a file.',
          })
        );
      }
    } catch (error) {
      console.error('Failed to store game state:', error);
      session.webSocket.send(
        JSON.stringify({
          type: 'exportGameStateFailed',
          message: 'Server error occurred while storing game state.',
        })
      );
    }
  }

  /**
   * Handle sync request for catching up missed actions
   */
  async handleSyncRequest(sessionId, data) {
    const session = this.sessions.get(sessionId);
    const requestCounter = data.counter || 0;

    // Send missing actions to the client
    if (this.roomInfo.actionData.length > 0) {
      const missingActions = this.roomInfo.actionData.filter(
        (action) => action.counter > requestCounter
      );

      if (missingActions.length > 0) {
        session.webSocket.send(
          JSON.stringify({
            type: 'catchUpActions',
            actionData: missingActions,
          })
        );
      }
    }
  }

  /**
   * Handle leave room request
   */
  async handleLeaveRoom(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove from players or spectators list
    if (session.isPlayer && session.username) {
      this.roomInfo.players.delete(session.username);

      // Broadcast to others that player left
      this.broadcast(sessionId, {
        type: 'leaveRoom',
        username: session.username,
        isSpectator: false,
      });
    } else if (session.isSpectator && session.username) {
      this.roomInfo.spectators.delete(session.username);

      // Broadcast to others that spectator left
      this.broadcast(sessionId, {
        type: 'leaveRoom',
        username: session.username,
        isSpectator: true,
      });
    }

    // Close the WebSocket connection
    try {
      session.webSocket.close();
    } catch (error) {
      console.error(
        `Error closing WebSocket for session ${sessionId}: ${error.message}`
      );
    }

    // Remove the session
    this.sessions.delete(sessionId);

    // Save updated room info
    await this.state.storage.put('roomInfo', this.roomInfo);
  }

  /**
   * Handle disconnection (browser closed, etc.)
   */
  async handleDisconnection(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Remove from players or spectators list
    if (session.isPlayer && session.username) {
      this.roomInfo.players.delete(session.username);

      // Broadcast to others that player disconnected
      this.broadcast(sessionId, {
        type: 'userDisconnected',
        username: session.username,
      });
    } else if (session.isSpectator && session.username) {
      this.roomInfo.spectators.delete(session.username);
    }

    // Remove the session
    this.sessions.delete(sessionId);

    // Save updated room info
    await this.state.storage.put('roomInfo', this.roomInfo);

    console.log(
      `Session ${sessionId} disconnected, ${this.sessions.size} active sessions remaining`
    );
  }

  /**
   * Broadcast a message to all connected clients except the sender
   */
  broadcast(excludeSessionId, message) {
    // Prepare the message
    const messageStr =
      typeof message === 'string' ? message : JSON.stringify(message);

    // Send to all active sessions except the sender
    for (const [id, session] of this.sessions.entries()) {
      if (
        id !== excludeSessionId &&
        session.roomId === this.sessions.get(excludeSessionId)?.roomId
      ) {
        try {
          session.webSocket.send(messageStr);
        } catch (error) {
          console.error(
            `Error sending message to session ${id}: ${error.message}`
          );
        }
      }
    }
  }

  /**
   * Schedule cleanup of inactive sessions
   */
  scheduleInactiveSessionCleanup() {
    const INACTIVE_TIMEOUT = 60 * 60 * 1000; // 1 hour

    // Only schedule if not already scheduled
    if (this.inactiveCleanupScheduled) return;

    this.inactiveCleanupScheduled = true;

    // Use setTimeout with Durable Object
    this.state.setAlarm(Date.now() + INACTIVE_TIMEOUT);
  }

  /**
   * Handle alarm to clean up inactive sessions
   */
  async alarm() {
    console.log('Running inactive session cleanup');
    this.inactiveCleanupScheduled = false;

    const now = Date.now();
    const INACTIVE_TIMEOUT = 60 * 60 * 1000; // 1 hour

    // Find inactive sessions
    const inactiveSessions = [];
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActive > INACTIVE_TIMEOUT) {
        inactiveSessions.push(id);
      }
    }

    // Handle disconnection for each inactive session
    for (const sessionId of inactiveSessions) {
      await this.handleDisconnection(sessionId);
    }

    console.log(`Cleaned up ${inactiveSessions.length} inactive sessions`);

    // If we still have active sessions, schedule another cleanup
    if (this.sessions.size > 0) {
      this.scheduleInactiveSessionCleanup();
    }
  }
}
