/**
 * PTCG-Sim-Meta Server
 * 
 * Enhanced server implementation with support for both PostgreSQL and SQLite databases.
 * This single file contains all the necessary logic without requiring modular files,
 * making it easier to deploy and maintain while we transition to a more modular architecture.
 */
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import pg from 'pg'; // PostgreSQL client
import fs from 'fs';
import { fileURLToPath } from 'url';

// Handle __dirname in ES modules and adjust for client folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../client');

// Load environment variables
dotenv.config();
console.log('Environment variables loaded');

/**
 * Database Configuration
 * Supports both PostgreSQL and SQLite with automatic fallback
 */

// PostgreSQL connection pool
let pgPool = null;
let usingPostgres = false;

// SQLite database path and instance
const dbFilePath = path.join(__dirname, 'database/db.sqlite');
let sqliteDb = null;
let isDatabaseCapacityReached = false;

/**
 * Initialize PostgreSQL connection if environment variables are available
 */
function initializePostgres() {
  const postgresUrl = process.env.DATABASE_POSTGRES_URL;
  
  if (!postgresUrl) {
    console.log('No PostgreSQL connection string found in environment variables');
    return false;
  }
  
  try {
    console.log('Initializing PostgreSQL connection...');
    
    pgPool = new pg.Pool({
      connectionString: postgresUrl,
      ssl: {
        rejectUnauthorized: false // Required for some PostgreSQL providers like Neon
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    // Test connection and create tables
    pgPool.connect((err, client, release) => {
      if (err) {
        console.error('Error connecting to PostgreSQL:', err);
        console.log('Will fall back to SQLite database');
        return;
      }
      
      console.log('Successfully connected to PostgreSQL database!');
      usingPostgres = true;
      
      // Create tables if they don't exist
      client.query(`
        CREATE TABLE IF NOT EXISTS key_value_pairs (
          key TEXT PRIMARY KEY,
          value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        release();
        if (err) {
          console.error('Error creating PostgreSQL tables:', err);
        } else {
          console.log('PostgreSQL tables initialized');
        }
      });
    });
    
    // Add error handler for the pool
    pgPool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
    
    return true;
  } catch (error) {
    console.error('Error initializing PostgreSQL:', error);
    return false;
  }
}

/**
 * Initialize SQLite database as fallback or primary storage
 */
function initializeSQLite() {
  try {
    console.log('Initializing SQLite database...');
    
    // Ensure database directory exists
    const dbDir = path.dirname(dbFilePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log(`Created database directory: ${dbDir}`);
    }
    
    sqliteDb = new sqlite3.Database(dbFilePath, (err) => {
      if (err) {
        console.error('Error opening SQLite database:', err);
        return;
      }
      
      console.log('Connected to SQLite database');
      
      // Create table if it doesn't exist
      sqliteDb.run(
        'CREATE TABLE IF NOT EXISTS KeyValuePairs (key TEXT PRIMARY KEY, value TEXT)',
        (err) => {
          if (err) {
            console.error('Error creating SQLite table:', err);
          } else {
            console.log('SQLite tables initialized');
          }
        }
      );
    });
  } catch (error) {
    console.error('Error initializing SQLite:', error);
  }
}

/**
 * Check SQLite database size
 * @returns {number} Size in GB
 */
function checkDatabaseSizeGB() {
  if (fs.existsSync(dbFilePath)) {
    try {
      const stats = fs.statSync(dbFilePath);
      const fileSizeInBytes = stats.size;
      const fileSizeInGB = fileSizeInBytes / (1024 * 1024 * 1024); // Convert bytes to gigabytes
      return fileSizeInGB;
    } catch (error) {
      console.error('Error checking database size:', error);
      return 0;
    }
  }
  return 0;
}

/**
 * Generate random key for game state storage
 * @param {number} length - Length of key
 * @returns {string} Random alphanumeric key
 */
function generateRandomKey(length) {
  const characters = 
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    key += characters.charAt(randomIndex);
  }
  return key;
}

/**
 * Main application function
 */
async function main() {
  console.log('Starting PTCG-Sim-Meta server...');
  
  // Initialize databases
  const postgresInitialized = initializePostgres();
  if (!postgresInitialized) {
    console.log('Using SQLite as primary database');
    initializeSQLite();
  } else {
    console.log('Using PostgreSQL as primary database with SQLite fallback');
    initializeSQLite(); // Initialize SQLite as fallback
  }
  
  // Check SQLite database size periodically
  const maxSizeGB = 15;
  setInterval(() => {
    const currentSize = checkDatabaseSizeGB();
    console.log(`Current SQLite database size: ${currentSize.toFixed(2)} GB`);
    if (currentSize > maxSizeGB) {
      isDatabaseCapacityReached = true;
      console.warn(`SQLite database size limit reached (${currentSize.toFixed(2)} GB > ${maxSizeGB} GB)`);
    }
  }, 1000 * 60 * 60); // Check every hour
  
  // Initialize Express application
  const app = express();
  const server = http.createServer(app);
  
  // Socket.IO Server Setup
  const io = new Server(server, {
    connectionStateRecovery: {},
    cors: {
      origin: ['https://admin.socket.io', 'https://ptcg-sim-meta.pages.dev', 'http://localhost:3000'],
      credentials: true,
    },
  });
  
  // Bcrypt Configuration
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
  
  // CORS Configuration
  const allowedOrigins = [
    'https://ptcg-sim-meta.pages.dev',  // Cloudflare Pages
    'http://localhost:3000',            // Local development frontend
    'http://localhost:4000'             // Local development backend
  ];
  
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));
  
  // Serve static files from client directory
  app.use(express.static(clientDir));
  
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
  
  /**
   * API endpoint to retrieve game state data by key
   * First tries PostgreSQL, then falls back to SQLite if necessary
   */
  app.get('/api/importData', async (req, res) => {
    console.log('Received request for /api/importData');
    
    const key = req.query.key;
    if (!key) {
      console.warn('Request missing key parameter');
      return res.status(400).json({ 
        success: false,
        error: 'Key parameter is missing' 
      });
    }
    
    console.log(`Looking up game state with key: ${key}`);
    
    try {
      // Try PostgreSQL first if available
      if (usingPostgres && pgPool) {
        try {
          console.log('Querying PostgreSQL database...');
          const result = await pgPool.query(
            'SELECT value FROM key_value_pairs WHERE key = $1',
            [key]
          );
          
          if (result.rows.length > 0) {
            try {
              console.log('Found game state in PostgreSQL');
              const jsonData = JSON.parse(result.rows[0].value);
              return res.json(jsonData);
            } catch (parseError) {
              console.error('Error parsing JSON data from PostgreSQL:', parseError);
              return res.status(500).json({ 
                success: false,
                error: 'Error parsing game state data' 
              });
            }
          } else {
            console.log('Key not found in PostgreSQL, trying SQLite...');
          }
        } catch (pgError) {
          console.error('PostgreSQL query error:', pgError);
          console.log('Falling back to SQLite database...');
        }
      }
      
      // If PostgreSQL is not available or the key wasn't found, try SQLite
      if (sqliteDb) {
        console.log('Querying SQLite database...');
        sqliteDb.get('SELECT value FROM KeyValuePairs WHERE key = ?', [key], (err, row) => {
          if (err) {
            console.error('SQLite query error:', err);
            return res.status(500).json({ 
              success: false,
              error: 'Database error' 
            });
          }
          
          if (row) {
            try {
              console.log('Found game state in SQLite');
              const jsonData = JSON.parse(row.value);
              return res.json(jsonData);
            } catch (parseError) {
              console.error('Error parsing JSON data from SQLite:', parseError);
              return res.status(500).json({ 
                success: false,
                error: 'Error parsing game state data' 
              });
            }
          } else {
            console.warn(`Game state with key ${key} not found in either database`);
            return res.status(404).json({ 
              success: false,
              error: 'Game state not found' 
            });
          }
        });
      } else {
        // Neither database is available
        console.error('No database connection available');
        return res.status(500).json({ 
          success: false,
          error: 'Database connection error' 
        });
      }
    } catch (error) {
      console.error('Unexpected error in /api/importData:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
      });
    }
  });
  
  // Room management data structure
  const roomInfo = new Map();
  
  // Function to periodically clean up empty rooms
  const cleanUpEmptyRooms = () => {
    let deletedRooms = 0;
    roomInfo.forEach((room, roomId) => {
      if (room.players.size === 0 && room.spectators.size === 0) {
        roomInfo.delete(roomId);
        deletedRooms++;
      }
    });
    if (deletedRooms > 0) {
      console.log(`Cleaned up ${deletedRooms} empty rooms`);
    }
  };
  
  // Set up a timer to clean up empty rooms every 5 minutes
  setInterval(cleanUpEmptyRooms, 5 * 60 * 1000);
  
  // Socket.IO Connection Handling
  io.on('connection', async (socket) => {
    console.log(`New socket connection: ${socket.id}`);
    
    // Function to handle disconnections (unintended)
    const disconnectHandler = (roomId, username) => {
      if (!socket.data.leaveRoom) {
        console.log(`User ${username} disconnected from room ${roomId}`);
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
    
    /**
     * Handle game state storage
     * First tries PostgreSQL, then falls back to SQLite if necessary
     */
    socket.on('storeGameState', async (exportData) => {
      console.log('Received storeGameState request');
      
      try {
        // Generate a unique key
        const key = generateRandomKey(4);
        console.log(`Generated key for game state: ${key}`);
        
        // Try to store in PostgreSQL first if available
        if (usingPostgres && pgPool) {
          try {
            console.log('Storing game state in PostgreSQL...');
            await pgPool.query(
              'INSERT INTO key_value_pairs (key, value) VALUES ($1, $2) ' + 
              'ON CONFLICT (key) DO UPDATE SET value = $2, created_at = CURRENT_TIMESTAMP',
              [key, exportData]
            );
            
            socket.emit('exportGameStateSuccessful', key);
            console.log(`Game state with key ${key} successfully stored in PostgreSQL`);
            return;
          } catch (pgError) {
            console.error('PostgreSQL error storing game state:', pgError);
            console.log('Falling back to SQLite storage...');
          }
        }
        
        // If PostgreSQL is not available or failed, use SQLite
        if (sqliteDb) {
          if (isDatabaseCapacityReached) {
            console.warn('SQLite database capacity reached, cannot store game state');
            socket.emit(
              'exportGameStateFailed',
              'Database storage limit reached. Please try exporting as a file instead.'
            );
          } else {
            console.log('Storing game state in SQLite...');
            sqliteDb.run(
              'INSERT OR REPLACE INTO KeyValuePairs (key, value) VALUES (?, ?)',
              [key, exportData],
              function(err) {
                if (err) {
                  console.error('SQLite error storing game state:', err);
                  socket.emit(
                    'exportGameStateFailed',
                    'Error exporting game! Please try again or save as a file.'
                  );
                } else {
                  socket.emit('exportGameStateSuccessful', key);
                  console.log(`Game state with key ${key} successfully stored in SQLite`);
                }
              }
            );
          }
        } else {
          console.error('No database connection available for storing game state');
          socket.emit(
            'exportGameStateFailed',
            'Database connection error. Please try exporting as a file instead.'
          );
        }
      } catch (error) {
        console.error('Unexpected error in storeGameState handler:', error);
        socket.emit(
          'exportGameStateFailed',
          'An unexpected error occurred. Please try exporting as a file instead.'
        );
      }
    });
    
    /**
     * Handle room joining
     */
    socket.on('joinGame', (roomId, username, isSpectator) => {
      console.log(`User ${username} attempting to join room ${roomId}${isSpectator ? ' as spectator' : ''}`);
      
      if (!roomInfo.has(roomId)) {
        roomInfo.set(roomId, { players: new Set(), spectators: new Set() });
        console.log(`Created new room: ${roomId}`);
      }
      
      const room = roomInfo.get(roomId);

      if (room.players.size < 2 || isSpectator) {
        socket.join(roomId);
        console.log(`User ${username} joined room ${roomId}`);
        
        // Check if the user is a spectator or there are fewer than 2 players
        if (isSpectator) {
          room.spectators.add(username);
          socket.emit('spectatorJoin');
          console.log(`User ${username} joined as spectator`);
        } else {
          room.players.add(username);
          socket.emit('joinGame');
          console.log(`User ${username} joined as player (${room.players.size}/2 players)`);
          
          socket.data.disconnectListener = () =>
            disconnectHandler(roomId, username);
          socket.on('disconnect', socket.data.disconnectListener);
        }
      } else {
        socket.emit('roomReject');
        console.log(`User ${username} rejected from full room ${roomId}`);
      }
    });
    
    /**
     * Handle user reconnection
     */
    socket.on('userReconnected', (data) => {
      console.log(`User ${data.username} reconnecting to room ${data.roomId}`);
      
      if (!roomInfo.has(data.roomId)) {
        roomInfo.set(data.roomId, {
          players: new Set(),
          spectators: new Set(),
        });
        console.log(`Created new room for reconnection: ${data.roomId}`);
      }
      
      const room = roomInfo.get(data.roomId);
      socket.join(data.roomId);
      
      if (!data.notSpectator) {
        room.spectators.add(data.username);
        console.log(`User ${data.username} reconnected as spectator`);
      } else {
        room.players.add(data.username);
        console.log(`User ${data.username} reconnected as player`);
        
        socket.data.disconnectListener = () =>
          disconnectHandler(data.roomId, data.username);
        socket.on('disconnect', socket.data.disconnectListener);
        io.to(data.roomId).emit('userReconnected', data);
      }
    });
    
    // List of socket events to forward
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
        console.log(`Forwarding ${event} event to room ${data?.roomId || 'unknown'}`);
        emitToRoom(event, data);
      });
    }
    
    // Handle socket disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
  
  // Get port from environment variable or use default
  const port = process.env.PORT || 4000;
  
  // Start the server
  server.listen(port, () => {
    console.log(`✨ PTCG-Sim-Meta server is running at http://localhost:${port}`);
    console.log(`💾 Using ${usingPostgres ? 'PostgreSQL' : 'SQLite'} as primary database`);
  });
  
  return server;
}

// Start the application
main().catch(error => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});