import { storeGameState, generateRandomKey } from './gamestate.js';

// Durable Object to manage individual game rooms with WebSocket connections
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
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      
      await this.handleSession(server);
      
      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }
    
    // Handle regular HTTP requests for commands
    if (request.method === 'POST') {
      const message = await request.json();
      await this.handleCommand(message);
      return new Response('OK');
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  async handleSession(webSocket) {
    // Generate a unique session ID
    const sessionId = generateRandomKey(16);
    
    // Set up event handlers for this WebSocket
    webSocket.accept();
    
    // Store the WebSocket session
    this.sessions.set(sessionId, {
      webSocket,
      username: null,
      isPlayer: false,
      isSpectator: false
    });
    
    webSocket.addEventListener('message', async msg => {
      try {
        const data = JSON.parse(msg.data);
        await this.handleWebSocketMessage(sessionId, data);
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    webSocket.addEventListener('close', () => {
      this.handleDisconnection(sessionId);
    });
  }
  
  async handleWebSocketMessage(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    // Handle various message types
    switch (data.type) {
      case 'joinGame':
        await this.handleJoinGame(sessionId, data);
        break;
      case 'storeGameState':
        await this.handleStoreGameState(sessionId, data);
        break;
      // Handle all the other events like in your current socket.io implementation
      // ...
      default:
        // Broadcast message to all other sessions
        this.broadcast(sessionId, data);
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
    
    // Clean up empty rooms
    if (this.roomInfo.players.size === 0 && this.roomInfo.spectators.size === 0) {
      // No need to delete the Durable Object as Cloudflare will handle this
    }
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