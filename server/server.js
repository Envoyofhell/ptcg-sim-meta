/**
 * PTCG-Sim-Meta Server Implementation
 * 
 * Comprehensive backend for Pokémon Trading Card Game Simulator
 * 
 * Key Features:
 * - PostgreSQL database integration
 * - Real-time Socket.IO communication
 * - Game state management
 * - Advanced room and user tracking
 * - Secure key generation and storage
 * 
 * @module ServerApplication
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { Router } from 'itty-router';
import { corsHeaders, handleOptions } from './src/utils/cors';
import { instrument } from '@socket.io/admin-ui';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg'; // PostgreSQL client
import { fileURLToPath } from 'url';

// Import environment configuration (ensure this path is correct)
import { ENV, currentEnv } from './config/env-config.js';

// Handle ES Module __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../client');

// Load environment variables
dotenv.config();

/**
 * Comprehensive Server Configuration
 * Dynamically adapts to different deployment environments
 */
const CONFIG = {
  // Server settings
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEBUG_MODE: process.env.DEBUG_MODE === 'true',
  
  // PostgreSQL settings
  POSTGRES_POOL_SIZE: parseInt(process.env.POSTGRES_POOL_SIZE || '20', 10),
  POSTGRES_IDLE_TIMEOUT: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
  POSTGRES_CONNECTION_TIMEOUT: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '5000', 10),
  
  // Game state settings
  GAME_STATE_KEY_LENGTH: parseInt(process.env.GAME_STATE_KEY_LENGTH || '4', 10),
  MAX_GAME_STATE_SIZE_MB: parseInt(process.env.MAX_GAME_STATE_SIZE_MB || '50', 10),
  DATA_RETENTION_DAYS: parseInt(process.env.DATA_RETENTION_DAYS || '30', 10),
  
  // Allowed origins for CORS
  ALLOWED_ORIGINS: [
    ...currentEnv.ALLOWED_ORIGINS || [],
    'https://ptcg-sim-meta.pages.dev',
    'https://ptcg-sim-meta-dev.pages.dev',
    'https://ptcg-sim-meta.jasonh1993.workers.dev',
    'https://ptcg-sim-meta-dev.jasonh1993.workers.dev',
    'http://localhost:3000',
    'http://localhost:4000'
  ],
};

// Console color definitions for enhanced logging
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// Global database connection variables
let pgPool = null;
let dbInitialized = false;
let databaseError = null;

/**
 * Enhanced Logging Utility
 * Provides context-aware logging with color and timestamp
 * 
 * @param {string} message - Log message
 * @param {string} [level='info'] - Log level
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const envPrefix = CONFIG.NODE_ENV === 'development' ? '🔧 DEV' : '🚀 PROD';
  
  const logLevels = {
    error: () => console.error(`${COLORS.red}[${timestamp}] ${envPrefix} ERROR:${COLORS.reset} ${message}`),
    warn: () => console.warn(`${COLORS.yellow}[${timestamp}] ${envPrefix} WARNING:${COLORS.reset} ${message}`),
    debug: () => {
      if (CONFIG.DEBUG_MODE) {
        console.log(`${COLORS.gray}[${timestamp}] ${envPrefix} DEBUG:${COLORS.reset} ${message}`);
      }
    },
    success: () => console.log(`${COLORS.green}[${timestamp}] ${envPrefix} SUCCESS:${COLORS.reset} ${message}`),
    info: () => console.log(`${COLORS.blue}[${timestamp}] ${envPrefix} INFO:${COLORS.reset} ${message}`)
  };

  (logLevels[level] || logLevels.info)();
}

/**
 * Initialize PostgreSQL connection with optimized settings
 * @returns {Promise<boolean>} Success status
 */
async function initializePostgres() {
  const postgresUrl = process.env.DATABASE_POSTGRES_URL;
  
  if (!postgresUrl) {
    databaseError = 'No PostgreSQL connection string found in environment variables';
    log(databaseError, 'error');
    return false;
  }
  
  try {
    log('Initializing PostgreSQL connection...', 'info');
    
    // Create connection pool with optimal settings
    pgPool = new pg.Pool({
      connectionString: postgresUrl,
      ssl: {
        rejectUnauthorized: false  // Important for Neon connections
      },
      max: CONFIG.POSTGRES_POOL_SIZE,
      idleTimeoutMillis: CONFIG.POSTGRES_IDLE_TIMEOUT,
      connectionTimeoutMillis: CONFIG.POSTGRES_CONNECTION_TIMEOUT,
      application_name: 'ptcg-sim-meta',
    });
    
    // Handle pool errors to prevent application crashes
    pgPool.on('error', (err) => {
      log(`PostgreSQL pool error: ${err.message}`, 'error');
      log(`Error details: ${JSON.stringify(err)}`, 'debug');
      dbInitialized = false;
    });
    
    // Test connection and create tables
    const client = await pgPool.connect();
    try {
      log('Connected to PostgreSQL database', 'success');
      
      // Create tables if they don't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS key_value_pairs (
          key TEXT PRIMARY KEY,
          value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          size_bytes BIGINT,
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `);
      
      // Create indices for faster querying
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_key_value_pairs_created_at 
        ON key_value_pairs (created_at)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_key_value_pairs_accessed_at 
        ON key_value_pairs (accessed_at)
      `);
      
      log('PostgreSQL tables and indices initialized', 'success');
      
      // Set up automatic cleanup function
      await client.query(`
        CREATE OR REPLACE FUNCTION cleanup_old_game_states()
        RETURNS void AS $$
        BEGIN
          DELETE FROM key_value_pairs 
          WHERE created_at < NOW() - INTERVAL '${CONFIG.DATA_RETENTION_DAYS} days';
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      log(`Database cleanup configured for records older than ${CONFIG.DATA_RETENTION_DAYS} days`, 'info');
      
      log('Database initialization completed successfully', 'success');
      dbInitialized = true;
      return true;
    } catch (error) {
      databaseError = `Error initializing database: ${error.message}`;
      log(databaseError, 'error');
      return false;
    } finally {
      client.release();
    }
  } catch (error) {
    databaseError = `Error initializing PostgreSQL: ${error.message}`;
    log(databaseError, 'error');
    return false;
  }
}

/**
 * Generate cryptographically stronger random key for game state storage
 * @param {number} length - Length of key
 * @returns {string} Random alphanumeric key
 */
function generateRandomKey(length) {
  const characters = 
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  
  // Use crypto if available for better randomness
  const getRandomValue = () => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0] / (0xFFFFFFFF + 1);
    } else {
      return Math.random();
    }
  };
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(getRandomValue() * characters.length);
    key += characters.charAt(randomIndex);
  }
  
  return key;
}

/**
 * Update access timestamp for a game state
 * @param {string} key - Game state key
 */
async function updateAccessTimestamp(key) {
  try {
    await pgPool.query(
      'UPDATE key_value_pairs SET accessed_at = NOW() WHERE key = $1',
      [key]
    );
    log(`Updated access timestamp for key ${key}`, 'debug');
  } catch (error) {
    log(`Error updating access timestamp: ${error.message}`, 'warn');
  }
}

/**
 * Perform manual cleanup of old records
 * @param {number} days - Days to keep records for
 */
async function cleanupOldRecords(days = CONFIG.DATA_RETENTION_DAYS) {
  try {
    const result = await pgPool.query(
      'DELETE FROM key_value_pairs WHERE created_at < NOW() - INTERVAL $1 DAY',
      [days]
    );
    log(`Cleaned up ${result.rowCount} old records from database`, 'info');
  } catch (error) {
    log(`Error during cleanup: ${error.message}`, 'error');
  }
}

/**
 * Validate game state key format
 * @param {string} key - Key to validate
 * @returns {boolean} Is key valid
 */
function isValidKey(key) {
  if (!key || typeof key !== 'string') {
    return false;
  }
  
  // Check key format (alphanumeric of specified length)
  const keyRegex = new RegExp(`^[a-zA-Z0-9]{${CONFIG.GAME_STATE_KEY_LENGTH}}$`);
  return keyRegex.test(key);
}

/**
 * Get database statistics
 * @returns {Promise<Object>} Database statistics
 */
async function getDatabaseStats() {
  try {
    const countResult = await pgPool.query('SELECT COUNT(*) FROM key_value_pairs');
    const sizeResult = await pgPool.query('SELECT SUM(size_bytes) FROM key_value_pairs');
    const oldestResult = await pgPool.query('SELECT MIN(created_at) FROM key_value_pairs');
    const newestResult = await pgPool.query('SELECT MAX(created_at) FROM key_value_pairs');
    
    return {
      recordCount: parseInt(countResult.rows[0].count, 10),
      totalSizeBytes: parseInt(sizeResult.rows[0].sum || '0', 10),
      oldestRecord: oldestResult.rows[0].min,
      newestRecord: newestResult.rows[0].max,
    };
  } catch (error) {
    log(`Error getting database stats: ${error.message}`, 'error');
    return {
      error: error.message,
    };
  }
}

/**
 * Main application function
 */
async function main() {
  log('Starting PTCG-Sim-Meta server (PostgreSQL only)...', 'info');
  log(`Environment: ${CONFIG.NODE_ENV}`, 'info');
  log(`Debug mode: ${CONFIG.DEBUG_MODE ? 'enabled' : 'disabled'}`, 'info');
  
  // Initialize PostgreSQL database
  const dbInitResult = await initializePostgres();
  if (!dbInitResult) {
    log('Warning: Server starting with database initialization errors', 'warn');
  }
  
  // Initialize Express application
  const app = express();
  
  // Enable JSON body parsing for POST requests
  app.use(express.json({ 
    limit: `${CONFIG.MAX_GAME_STATE_SIZE_MB}mb`,
    type: ['application/json', 'text/plain']
  }));
  
  const server = http.createServer(app);
  
  // Socket.IO Server Setup with comprehensive CORS configuration
  const io = new Server(server, {
    connectionStateRecovery: {
      maxDisconnectionDuration: 30000,
      skipMiddlewares: true,
    },
    cors: {
      origin: ["https://ptcg-sim-meta.pages.dev", "https://ptcg-sim-meta-dev.pages.dev"],
      methods: ["GET", "POST"],
      credentials: true
    },
    // Additional Socket.IO options for better performance
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['polling', 'websocket'],
    allowEIO3: true,
  });
  
  // Bcrypt Configuration
  const saltRounds = 10;
  const plainPassword = process.env.ADMIN_PASSWORD || 'defaultPassword';
  if (process.env.ADMIN_PASSWORD === undefined) {
    log('No ADMIN_PASSWORD environment variable set, using default password', 'warn');
  }
  const hashedPassword = bcrypt.hashSync(plainPassword, saltRounds);
  
  // Socket.IO Admin Instrumentation
  instrument(io, {
    auth: {
      type: 'basic',
      username: process.env.ADMIN_USERNAME || 'admin',
      password: hashedPassword,
    },
    mode: CONFIG.NODE_ENV === 'production' ? 'production' : 'development',
    namespaceName: '/admin',
  });
  
  // Comprehensive CORS Configuration for Express
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (CONFIG.ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        log(`CORS blocked request from origin: ${origin}`, 'warn');
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // Cache preflight requests for 24 hours
  }));
  
  // Serve static files from client directory
  app.use(express.static(clientDir));
  
  // Request logging middleware
  app.use((req, res, next) => {
    log(`${req.method} ${req.url}`, 'debug');
    
    // Add JSON content type header to all API responses
    if (req.url.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
    }
    
    // Track response time
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`, 'debug');
    });
    
    next();
  });
  
  // Error handling middleware
  app.use((err, req, res, next) => {
    log(`Express error: ${err.message}`, 'error');
    
    // Always set JSON content type for API errors
    if (req.url.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
    
    // For non-API routes, continue to next error handler
    next(err);
  });
  
  // Health check endpoint for monitoring
  app.get('/health', (req, res) => {
    res.json({
      status: dbInitialized ? 'ok' : 'database_error',
      timestamp: new Date().toISOString(),
      database: dbInitialized ? 'connected' : 'error',
      databaseError: databaseError,
      version: process.env.npm_package_version || '1.0.0',
      env: CONFIG.NODE_ENV,
      uptime: process.uptime()
    });
  });
  // Add this endpoint to test database connection
app.get('/api/db-test', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    if (!pgPool) {
      return res.status(500).json({
        success: false,
        error: 'Database pool not initialized'
      });
    }
    
    // Try to connect and run a simple query
    const client = await pgPool.connect();
    try {
      const result = await client.query('SELECT NOW() as time');
      
      // Also test our table
      const tableTest = await client.query(
        'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
        ['key_value_pairs']
      );
      
      return res.json({
        success: true,
        message: 'Database connection successful',
        time: result.rows[0].time,
        tableExists: tableTest.rows[0].exists
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      stack: error.stack
    });
  }
});
  // Database stats endpoint
  app.get('/api/stats', async (req, res) => {
    if (!dbInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Database not initialized',
        details: databaseError
      });
    }
    
    try {
      const stats = await getDatabaseStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      log(`Error getting database stats: ${error.message}`, 'error');
      res.status(500).json({
        success: false,
        error: 'Error retrieving database statistics'
      });
    }
  });
  
  // Main application route
  app.get('/', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
  
  // Import page route
  app.get('/import', (req, res) => {
    const key = req.query.key;
    if (!key) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ 
          success: false,
          error: 'Key parameter is missing' 
        });
      } else {
        // If browser request, still serve the page
        return res.sendFile(path.join(clientDir, 'index.html'));
      }
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });
  
  /**
   * API endpoint to retrieve game state data by key
   * Enhanced with better error handling and response formatting
   */
  app.get('/api/importData', async (req, res) => {
    log('Received request for /api/importData', 'debug');
    
    // Database check
    if (!dbInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
        details: databaseError
      });
    }
    
    const key = req.query.key;
    if (!key) {
      log('Request missing key parameter', 'warn');
      return res.status(400).json({ 
        success: false,
        error: 'Key parameter is missing' 
      });
    }
    
    // Validate key format
    if (!isValidKey(key)) {
      log(`Invalid key format: ${key}`, 'warn');
      return res.status(400).json({
        success: false,
        error: 'Invalid key format'
      });
    }
    
    log(`Looking up game state with key: ${key}`, 'debug');
    
    try {
      const result = await pgPool.query(
        'SELECT value FROM key_value_pairs WHERE key = $1',
        [key]
      );
      
      if (result.rows.length > 0) {
        try {
          log(`Found game state with key: ${key}`, 'success');
          
          // Update access timestamp asynchronously (don't wait for it)
          updateAccessTimestamp(key).catch(err => {
            log(`Error updating timestamp: ${err.message}`, 'warn');
          });
          
          // Parse and return the JSON data
          const jsonData = JSON.parse(result.rows[0].value);
          return res.json(jsonData);
        } catch (parseError) {
          log(`Error parsing JSON data: ${parseError.message}`, 'error');
          return res.status(500).json({ 
            success: false,
            error: 'Error parsing game state data',
            details: parseError.message
          });
        }
      } else {
        log(`Game state with key ${key} not found`, 'warn');
        return res.status(404).json({ 
          success: false,
          error: 'Game state not found' 
        });
      }
    } catch (dbError) {
      log(`Database error: ${dbError.message}`, 'error');
      return res.status(500).json({ 
        success: false,
        error: 'Database error',
        details: dbError.message
      });
    }
  });
  
  /**
   * API endpoint to store game state data with a key
   * Direct HTTP storage option (alternative to Socket.IO)
   */
  app.post('/api/storeGameState', async (req, res) => {
    log('Received POST request for /api/storeGameState', 'debug');
    
    // Database check
    if (!dbInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
        details: databaseError
      });
    }
    
    // Check if the request body contains game state data
    if (!req.body || !req.body.gameState) {
      log('Request missing gameState in body', 'warn');
      return res.status(400).json({
        success: false,
        error: 'Game state data is missing'
      });
    }
    
    try {
      // Generate a unique key or use provided key
      const key = req.body.key || generateRandomKey(CONFIG.GAME_STATE_KEY_LENGTH);
      
      // Validate custom key if provided
      if (req.body.key && !isValidKey(req.body.key)) {
        log(`Invalid custom key format: ${req.body.key}`, 'warn');
        return res.status(400).json({
          success: false,
          error: 'Invalid key format'
        });
      }
      
      // Convert game state to string if it's an object
      const gameStateData = typeof req.body.gameState === 'string' 
        ? req.body.gameState 
        : JSON.stringify(req.body.gameState);
      
      log(`Generated key for game state: ${key}`, 'debug');
      
      // Calculate size for metrics
      const sizeBytes = Buffer.byteLength(gameStateData, 'utf8');
      const sizeMB = sizeBytes / (1024 * 1024);
      
      // Check if game state is too large
      if (sizeMB > CONFIG.MAX_GAME_STATE_SIZE_MB) {
        log(`Game state too large: ${sizeMB.toFixed(2)}MB > ${CONFIG.MAX_GAME_STATE_SIZE_MB}MB`, 'warn');
        return res.status(413).json({
          success: false,
          error: `Game state too large (${sizeMB.toFixed(2)}MB > ${CONFIG.MAX_GAME_STATE_SIZE_MB}MB limit)`
        });
      }
      
      // Store metadata if provided
      const metadata = req.body.metadata || {};
      
      // Store in database
      await pgPool.query(
        `INSERT INTO key_value_pairs (key, value, created_at, accessed_at, size_bytes, metadata) 
         VALUES ($1, $2, NOW(), NOW(), $3, $4) 
         ON CONFLICT (key) DO UPDATE 
         SET value = $2, created_at = NOW(), accessed_at = NOW(), size_bytes = $3, metadata = $4`,
        [key, gameStateData, sizeBytes, JSON.stringify(metadata)]
      );
      
      log(`Game state with key ${key} successfully stored in database (${sizeMB.toFixed(2)}MB)`, 'success');
      return res.status(201).json({
        success: true,
        key: key,
        size: {
          bytes: sizeBytes,
          megabytes: sizeMB.toFixed(2)
        }
      });
    } catch (error) {
      log(`Error storing game state: ${error.message}`, 'error');
      
      return res.status(500).json({
        success: false,
        error: 'Error storing game state in database',
        details: error.message
      });
    }
  });
  
  /**
   * API endpoint to delete a game state
   */
  app.delete('/api/gameState/:key', async (req, res) => {
    const key = req.params.key;
    
    // Database check
    if (!dbInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
        details: databaseError
      });
    }
    
    // Validate key format
    if (!isValidKey(key)) {
      log(`Invalid key format for deletion: ${key}`, 'warn');
      return res.status(400).json({
        success: false,
        error: 'Invalid key format'
      });
    }
    
    try {
      const result = await pgPool.query(
        'DELETE FROM key_value_pairs WHERE key = $1',
        [key]
      );
      
      if (result.rowCount > 0) {
        log(`Deleted game state ${key} from database`, 'success');
        return res.json({ success: true });
      } else {
        return res.status(404).json({
          success: false,
          error: 'Game state not found'
        });
      }
    } catch (error) {
      log(`Error deleting game state: ${error.message}`, 'error');
      return res.status(500).json({
        success: false,
        error: 'Database error',
        details: error.message
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
      log(`Cleaned up ${deletedRooms} empty rooms`, 'debug');
    }
  };
  
  // Set up a timer to clean up empty rooms every 5 minutes
  setInterval(cleanUpEmptyRooms, 300000);
  
  // Set up periodic database maintenance
  setInterval(() => {
    if (dbInitialized) {
      cleanupOldRecords(CONFIG.DATA_RETENTION_DAYS);
    }
  }, 24 * 60 * 60 * 1000); // Run once per day
  
  // Socket.IO Connection Handling
  io.on('connection', async (socket) => {
    log(`New socket connection: ${socket.id}`, 'debug');
    
    // Add socket error handling
    socket.on('error', (error) => {
      log(`Socket error for ${socket.id}: ${error.message}`, 'error');
    });
    
    // Function to handle disconnections (unintended)
    const disconnectHandler = (roomId, username) => {
      if (!socket.data.leaveRoom) {
        log(`User ${username} disconnected from room ${roomId}`, 'debug');
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
      if (!data || !data.roomId) {
        log(`Invalid data for ${eventName} event`, 'warn');
        return;
      }
      
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
     * Handle game state storage via Socket.IO
     * Optimized for better error handling and performance
     */
    socket.on('storeGameState', async (exportData) => {
      log(`Received storeGameState request from ${socket.id}`, 'debug');
      
      // Database check
      if (!dbInitialized) {
        socket.emit(
          'exportGameStateFailed',
          'Database not available. Please try exporting as a file instead.'
        );
        return;
      }
      
      try {
        // Validate data
        if (!exportData || typeof exportData !== 'string') {
          log('Invalid game state data format', 'warn');
          socket.emit(
            'exportGameStateFailed',
            'Invalid game state format. Please try again.'
          );
          return;
        }
        
        // Generate a unique key
        const key = generateRandomKey(CONFIG.GAME_STATE_KEY_LENGTH);
        log(`Generated key ${key} for socket ${socket.id}`, 'debug');
        
        // Calculate size for metrics
        const sizeBytes = Buffer.byteLength(exportData, 'utf8');
        const sizeMB = sizeBytes / (1024 * 1024);
        log(`Game state size: ${sizeMB.toFixed(2)} MB`, 'debug');
        
        // Check if game state is too large
        if (sizeMB > CONFIG.MAX_GAME_STATE_SIZE_MB) {
          log(`Game state too large: ${sizeMB.toFixed(2)} MB > ${CONFIG.MAX_GAME_STATE_SIZE_MB} MB`, 'warn');
          socket.emit(
            'exportGameStateFailed',
            `Game state too large (${sizeMB.toFixed(2)} MB). Please try exporting as a file instead.`
          );
          return;
        }
        
        // Store in database with metadata
        const metadata = {
          socketId: socket.id,
          userAgent: socket.handshake.headers['user-agent'],
          timestamp: new Date().toISOString(),
        };
        
        await pgPool.query(
          `INSERT INTO key_value_pairs (key, value, created_at, accessed_at, size_bytes, metadata) 
           VALUES ($1, $2, NOW(), NOW(), $3, $4) 
           ON CONFLICT (key) DO UPDATE 
           SET value = $2, created_at = NOW(), accessed_at = NOW(), size_bytes = $3, metadata = $4`,
          [key, exportData, sizeBytes, JSON.stringify(metadata)]
        );
        
        socket.emit('exportGameStateSuccessful', key);
        log(`Game state with key ${key} successfully stored (${sizeMB.toFixed(2)} MB)`, 'success');
      } catch (error) {
        log(`Error storing game state: ${error.message}`, 'error');
        socket.emit(
          'exportGameStateFailed',
          'An error occurred while storing your game state. Please try again or export as a file.'
        );
      }
    });
    
    /**
     * Handle room joining with improved validation and error handling
     */
    socket.on('joinGame', (roomId, username, isSpectator) => {
      // Validate inputs
      if (!roomId || typeof roomId !== 'string') {
        log(`Invalid roomId in joinGame request: ${roomId}`, 'warn');
        socket.emit('roomReject', 'Invalid room ID');
        return;
      }
      
      if (!username || typeof username !== 'string') {
        log(`Invalid username in joinGame request: ${username}`, 'warn');
        socket.emit('roomReject', 'Invalid username');
        return;
      }
      
      log(`User ${username} attempting to join room ${roomId}${isSpectator ? ' as spectator' : ''}`);
      
      // Create room if it doesn't exist
      if (!roomInfo.has(roomId)) {
        roomInfo.set(roomId, { 
          players: new Set(), 
          spectators: new Set(),
          created: new Date().toISOString(),
          messages: []
        });
        log(`Created new room: ${roomId}`, 'info');
      }
      
      const room = roomInfo.get(roomId);

      // Check if the room has space or if user is spectator
      if (room.players.size < 2 || isSpectator) {
        socket.join(roomId);
        log(`User ${username} joined room ${roomId}`, 'success');
        
        if (isSpectator) {
          room.spectators.add(username);
          socket.emit('spectatorJoin', {
            roomId,
            playerCount: room.players.size,
            spectatorCount: room.spectators.size
          });
          log(`User ${username} joined as spectator (${room.spectators.size} spectator(s))`, 'success');
        } else {
          room.players.add(username);
          socket.emit('joinGame', {
            roomId,
            playerCount: room.players.size,
            spectatorCount: room.spectators.size
          });
          log(`User ${username} joined as player (${room.players.size}/2 players)`, 'success');
          
          // Set up disconnect listener
          socket.data.disconnectListener = () => disconnectHandler(roomId, username);
          socket.on('disconnect', socket.data.disconnectListener);
        }
        
        // Notify everyone in the room about the new user
        socket.to(roomId).emit('userJoined', {
          username,
          isSpectator,
          playerCount: room.players.size,
          spectatorCount: room.spectators.size
        });
      } else {
        socket.emit('roomReject', 'Room is full');
        log(`User ${username} rejected from full room ${roomId}`, 'warn');
      }
    });
    
    /**
     * Handle user reconnection with improved state management
     */
    socket.on('userReconnected', (data) => {
      // Validate data
      if (!data || !data.roomId || !data.username) {
        log('Invalid data in userReconnected request', 'warn');
        socket.emit('reconnectFailed', 'Invalid reconnection data');
        return;
      }
      
      log(`User ${data.username} reconnecting to room ${data.roomId}`);
      
      // Create room if it doesn't exist
      if (!roomInfo.has(data.roomId)) {
        roomInfo.set(data.roomId, {
          players: new Set(),
          spectators: new Set(),
          created: new Date().toISOString(),
          messages: []
        });
        log(`Created new room for reconnection: ${data.roomId}`, 'info');
      }
      
      const room = roomInfo.get(data.roomId);
      socket.join(data.roomId);
      
      if (!data.notSpectator) {
        room.spectators.add(data.username);
        log(`User ${data.username} reconnected as spectator`, 'success');
        socket.emit('reconnectSuccess', {
          type: 'spectator',
          roomId: data.roomId,
          playerCount: room.players.size,
          spectatorCount: room.spectators.size
        });
      } else {
        room.players.add(data.username);
        log(`User ${data.username} reconnected as player`, 'success');
        
        // Set up disconnect listener
        socket.data.disconnectListener = () => disconnectHandler(data.roomId, data.username);
        socket.on('disconnect', socket.data.disconnectListener);
        
        // Notify all clients in the room
        io.to(data.roomId).emit('userReconnected', {
          username: data.username,
          roomId: data.roomId,
          playerCount: room.players.size,
          spectatorCount: room.spectators.size
        });
        
        socket.emit('reconnectSuccess', {
          type: 'player',
          roomId: data.roomId,
          playerCount: room.players.size,
          spectatorCount: room.spectators.size
        });
      }
    });
    
    /**
     * Process Socket.IO chat messages with moderation
     */
    socket.on('appendMessage', (data) => {
      if (!data || !data.roomId || !data.message) {
        log('Invalid message data', 'warn');
        return;
      }
      
      // Basic message validation and moderation
      const sanitizedMessage = data.message.substring(0, 500); // Limit message length
      
      // Store message in room history (limited to last 100 messages)
      if (roomInfo.has(data.roomId)) {
        const room = roomInfo.get(data.roomId);
        room.messages.push({
          username: data.username || 'Unknown',
          message: sanitizedMessage,
          timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 messages
        if (room.messages.length > 100) {
          room.messages.shift();
        }
      }
      
      // Forward the message to all users in the room
      emitToRoom('appendMessage', {
        ...data,
        message: sanitizedMessage
      });
    });
    
    // List of Socket.IO events to forward with validation
    const events = [
      'leaveRoom',
      'requestAction',
      'pushAction',
      'resyncActions',
      'catchUpActions',
      'syncCheck',
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
    
    // Register event listeners with improved error handling
    for (const event of events) {
      socket.on(event, (data) => {
        try {
          // Basic validation
          if (!data || !data.roomId) {
            log(`Invalid data for ${event} event`, 'warn');
            return;
          }
          
          if (CONFIG.DEBUG_MODE) {
            log(`Forwarding ${event} event to room ${data.roomId}`, 'debug');
          }
          
          // Forward event to room
          emitToRoom(event, data);
        } catch (error) {
          log(`Error processing ${event} event: ${error.message}`, 'error');
        }
      });
    }
    
    // Handle socket disconnection
    socket.on('disconnect', (reason) => {
      log(`Socket disconnected: ${socket.id}, reason: ${reason}`, 'debug');
    });
  });
  
  // Get port from environment variable or use default
  const port = CONFIG.PORT;
  
  // Start the server with enhanced error handling
  try {
    server.listen(port, () => {
      log(`✨ PTCG-Sim-Meta server is running at http://localhost:${port}`, 'success');
      log(`💾 Database status: ${dbInitialized ? 'Connected' : 'Error - ' + databaseError}`, 'info');
      
      // Log environment information for debugging
      log(`Node.js version: ${process.version}`, 'debug');
      log(`Environment: ${CONFIG.NODE_ENV}`, 'debug');
    });
    
    // Handle server errors
    server.on('error', (error) => {
      log(`Server error: ${error.message}`, 'error');
      
      if (error.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use. Please use a different port.`, 'error');
        process.exit(1);
      }
    });
    
    return server;
  } catch (error) {
    log(`Error starting server: ${error.message}`, 'error');
    throw error;
  }
}

// Process signal handling for graceful shutdown
process.on('SIGTERM', () => {
  log('SIGTERM signal received. Shutting down gracefully...', 'info');
  
  // Close database connection if open
  if (pgPool) {
    pgPool.end().catch(err => {
      log(`Error closing database connection: ${err.message}`, 'error');
    });
  }
  
  // Exit with success code
  process.exit(0);
});

process.on('SIGINT', () => {
  log('SIGINT signal received. Shutting down gracefully...', 'info');
  
  // Close database connection if open
  if (pgPool) {
    pgPool.end().catch(err => {
      log(`Error closing database connection: ${err.message}`, 'error');
    });
  }
  
  // Exit with success code
  process.exit(0);
});

// Unhandled error handling
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`, 'error');
  log(`Stack trace: ${error.stack}`, 'debug');
  
  // Keep process running but log the error
  // Don't exit the process as it could be a non-fatal error
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled promise rejection: ${reason}`, 'error');
  
  // Keep process running but log the error
  // Don't exit the process as it could be a non-fatal error
});

export default main;
// Start the application with improved error handling
main().catch(error => {
  log(`Fatal error starting server: ${error.message}`, 'error');
  
  // Log stack trace in debug mode
  if (CONFIG.DEBUG_MODE) {
    log(`Stack trace: ${error.stack}`, 'debug');
  }
  
  process.exit(1);
});