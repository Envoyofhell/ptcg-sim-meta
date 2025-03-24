// workers/game-room.js
// Durable Object for real-time game room management
import { storeGameState, generateRandomKey } from './gamestate.js';

export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.roomInfo = {
      players: new Map(),
      spectators: new Map()
    };
    
    // Load persistent state
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get('roomInfo');
      if (stored) {
        this.roomInfo = stored;
      }
    });
  }
  
  async fetch(request) {
    // Handle WebSocket connections
    if (request.headers.get('Upgrade') === 'websocket') {
      // Create a WebSocket pair
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      // Set up the server's WebSocket handlers
      await this.handleSession(server);
      
      // Return the client end of the WebSocket
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  async handleSession(webSocket) {
    // Generate a unique session ID
    const sessionId = generateRandomKey(16);
    
    // Accept the WebSocket connection
    webSocket.accept();
    
    // Store the WebSocket session
    this.sessions.set(sessionId, {
      webSocket,
      username: null,
      isPlayer: false,
      isSpectator: false
    });
    
    // Set up message handler
    webSocket.addEventListener('message', async msg => {
      try {
        const data = JSON.parse(msg.data);
        await this.handleWebSocketMessage(sessionId, data);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    // Set up close handler
    webSocket.addEventListener('close', () => {
      this.handleDisconnection(sessionId);
    });
  }
  
  async handleWebSocketMessage(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Handle message based on type
    switch (data.type) {
      case 'joinGame':
        await this.handleJoinGame(sessionId, data);
        break;
      case 'storeGameState':
        await this.handleStoreGameState(sessionId, data);
        break;
      case 'leaveRoom':
        await this.handleLeaveRoom(sessionId, data);
        break;
      default:
        // Broadcast other message types to all clients
        this.broadcast(sessionId, data);
        break;
    }
  }
  
  async handleJoinGame(sessionId, data) {
    const session = this.sessions.get(sessionId);
    session.username = data.username;
    
    if (data.isSpectator) {
      session.isSpectator = true;
      this.roomInfo.spectators.set(data.username, sessionId);
      session.webSocket.send(JSON.stringify({ type: 'spectatorJoin' }));
    } else {
      if (this.roomInfo.players.size < 2) {
        session.isPlayer = true;
        this.roomInfo.players.set(data.username, sessionId);
        session.webSocket.send(JSON.stringify({ type: 'joinGame' }));
      } else {
        session.webSocket.send(JSON.stringify({ type: 'roomReject' }));
      }
    }
    
    // Save room state
    await this.state.storage.put('roomInfo', this.roomInfo);
  }
  
  async handleStoreGameState(sessionId, data) {
    const key = generateRandomKey(4);
    const success = await storeGameState(this.env, key, data.exportData);
    
    const session = this.sessions.get(sessionId);
    if (success) {
      session.webSocket.send(JSON.stringify({ 
        type: 'exportGameStateSuccessful', 
        key 
      }));
    } else {
      session.webSocket.send(JSON.stringify({ 
        type: 'exportGameStateFailed', 
        message: 'Error exporting game! Please try again or save as a file.'
      }));
    }
  }
  
  async handleLeaveRoom(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Handle player leaving
    if (session.isPlayer && session.username) {
      this.roomInfo.players.delete(session.username);
      this.broadcast(sessionId, {
        type: 'leaveRoom',
        username: session.username
      });
    } else if (session.isSpectator && session.username) {
      this.roomInfo.spectators.delete(session.username);
    }
    
    // Save room state
    await this.state.storage.put('roomInfo', this.roomInfo);
  }
  
  handleDisconnection(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Remove from players or spectators
    if (session.isPlayer && session.username) {
      this.roomInfo.players.delete(session.username);
      this.broadcast(sessionId, {
        type: 'userDisconnected',
        username: session.username
      });
    } else if (session.isSpectator && session.username) {
      this.roomInfo.spectators.delete(session.username);
    }
    
    // Remove the session
    this.sessions.delete(sessionId);
    
    // Save room state
    this.state.storage.put('roomInfo', this.roomInfo);
  }
  
  broadcast(excludeSessionId, message) {
    // Send message to all connected WebSockets except the sender
    for (const [sessionId, session] of this.sessions.entries()) {
      if (sessionId !== excludeSessionId) {
        session.webSocket.send(JSON.stringify(message));
      }
    }
  }
}