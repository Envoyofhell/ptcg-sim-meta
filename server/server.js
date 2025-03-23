/**
 * PTCG-Sim-Meta Main Server
 * 
 * This is the main entry point for the server.
 * It uses the modular structure to handle database, CORS, and API routes.
 */
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Import modular components
import { initializeDatabase } from './config/database.js';
import { applyCors } from './middleware/cors-middleware.js';
import { generateRandomKey } from './utils/key-generator.js';
import { storeGameState, getGameState } from './services/game-state.js';
import apiRoutes from './routes/api-routes.js';

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../client');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  // Initialize Express app
  const app = express();
  const server = http.createServer(app);

  // Initialize database
  await initializeDatabase();
  
  // Apply CORS middleware
  applyCors(app, [
    // Add any additional domains that need access here
  ]);

  // Socket.IO Server Setup
  const io = new Server(server, {
    connectionStateRecovery: {},
    cors: {
      origin: ['https://admin.socket.io', 'https://ptcg-sim-meta.pages.dev', 'http://localhost:3000'],
      credentials: true,
    },
  });

  // Bcrypt Configuration for admin UI
  const saltRounds = 10;
  const plainPassword = process.env.ADMIN_PASSWORD || 'defaultPassword';
  const hashedPassword = bcrypt.hashSync(plainPassword, saltRounds);

  // Socket.IO Admin Instrumentation
  instrument(io, {
    auth: {
      type: 'basic',
      username: 'admin',
      password: hashedPassword,
    },
    mode: 'development',
  });

  // Serve static files from client directory
  app.use(express.static(clientDir));
  
  // API routes
  app.use('/api', apiRoutes);

  // Main application route
  app.get('/', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  // Import page route
  app.get('/import', (req, res) => {
    const key = req.query.key;
    if (!key) {
      return res.status(400).json({ error: 'Key parameter is missing' });
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  // Room management
  const roomInfo = new Map();
  
  // Function to periodically clean up empty rooms
  const cleanUpEmptyRooms = () => {
    roomInfo.forEach((room, roomId) => {
      if (room.players.size === 0 && room.spectators.size === 0) {
        roomInfo.delete(roomId);
      }
    });
  };
  
  // Set up a timer to clean up empty rooms every 5 minutes
  setInterval(cleanUpEmptyRooms, 5 * 60 * 1000);
  
  // Socket.IO Connection Handling
  io.on('connection', async (socket) => {
    // Function to handle disconnections (unintended)
    const disconnectHandler = (roomId, username) => {
      if (!socket.data.leaveRoom) {
        socket.to(roomId).emit('userDisconnected', username);
      }
      // Remove the disconnected user from the roomInfo map
      if (roomInfo.has(roomId)) {
        const room = roomInfo.get(roomId);

        if (room.players.has(username)) {
          room.players.delete(username);
        } else if (room.spectators.has(username)) {
          room.spectators.delete(username);
        }

        // If both players and spectators are empty, remove the roomInfo entry
        if (room.players.size === 0 && room.spectators.size === 0) {
          roomInfo.delete(roomId);
        }
      }
    };
    
    // Function to handle event emission
    const emitToRoom = (eventName, data) => {
      socket.broadcast.to(data.roomId).emit(eventName, data);
      if (eventName === 'leaveRoom') {
        socket.leave(data.roomId);
        if (socket.data.disconnectListener) {
          socket.data.leaveRoom = true;
          socket.data.disconnectListener();
          socket.removeListener('disconnect', socket.data.disconnectListener);
          socket.data.leaveRoom = false;
        }
      }
    };
    
    // Handle game state storage - using the service now
    socket.on('storeGameState', async (exportData) => {
      try {
        // Generate a unique key
        const key = generateRandomKey(4);
        
        // Store the game state using the service
        const result = await storeGameState(exportData, key);
        
        if (result.success) {
          socket.emit('exportGameStateSuccessful', key);
          console.log(`Game state with key ${key} successfully stored`);
        } else {
          socket.emit(
            'exportGameStateFailed',
            result.error || 'Error exporting game! Please try again or save as a file.'
          );
        }
      } catch (error) {
        console.error('Error in storeGameState handler:', error);
        socket.emit(
          'exportGameStateFailed',
          'Error exporting game! Please try again or save as a file.'
        );
      }
    });

    // Room join handling
    socket.on('joinGame', (roomId, username, isSpectator) => {
      if (!roomInfo.has(roomId)) {
        roomInfo.set(roomId, { players: new Set(), spectators: new Set() });
      }
      const room = roomInfo.get(roomId);

      if (room.players.size < 2 || isSpectator) {
        socket.join(roomId);
        // Check if the user is a spectator or there are fewer than 2 players
        if (isSpectator) {
          room.spectators.add(username);
          socket.emit('spectatorJoin');
        } else {
          room.players.add(username);
          socket.emit('joinGame');
          socket.data.disconnectListener = () =>
            disconnectHandler(roomId, username);
          socket.on('disconnect', socket.data.disconnectListener);
        }
      } else {
        socket.emit('roomReject');
      }
    });

    // User reconnection handling
    socket.on('userReconnected', (data) => {
      if (!roomInfo.has(data.roomId)) {
        roomInfo.set(data.roomId, {
          players: new Set(),
          spectators: new Set(),
        });
      }
      const room = roomInfo.get(data.roomId);
      socket.join(data.roomId);
      if (!data.notSpectator) {
        room.spectators.add(data.username);
      } else {
        room.players.add(data.username);
        socket.data.disconnectListener = () =>
          disconnectHandler(data.roomId, data.username);
        socket.on('disconnect', socket.data.disconnectListener);
        io.to(data.roomId).emit('userReconnected', data);
      }
    });

    // List of socket events
    const events = [
      'leaveRoom',
      'requestAction',
      'pushAction',
      'resyncActions',
      'catchUpActions',
      'syncCheck',
      'appendMessage',
      'spectatorActionData',
      'initiateImport',
      'endImport',
      'lookAtCards',
      'stopLookingAtCards',
      'revealCards',
      'hideCards',
      'revealShortcut',
      'hideShortcut',
      'lookShortcut',
      'stopLookingShortcut',
    ];

    // Register event listeners using the common function
    for (const event of events) {
      socket.on(event, (data) => {
        emitToRoom(event, data);
      });
    }
  });

  // Get port from environment variable or use default
  const port = process.env.PORT || 4000;
  
  server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });

  return server;
}

// Start the server
main().catch(error => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});