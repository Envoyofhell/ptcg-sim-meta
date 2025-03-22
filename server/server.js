/**
 * PTCG-Sim-Meta Server
 * 
 * Enhanced server implementation with optimized PostgreSQL support and SQLite fallback.
 * This implementation includes improved error handling, connection pooling,
 * and robust game state management for the PTCG-Sim-Meta application.
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

// Application constants - can be moved to environment variables
const POSTGRES_POOL_SIZE = process.env.POSTGRES_POOL_SIZE || 20;
const POSTGRES_IDLE_TIMEOUT = process.env.POSTGRES_IDLE_TIMEOUT || 30000;
const POSTGRES_CONNECTION_TIMEOUT = process.env.POSTGRES_CONNECTION_TIMEOUT || 5000;
const DEFAULT_PORT = process.env.PORT || 4000;
const SQLITE_MAX_SIZE_GB = process.env.SQLITE_MAX_SIZE_GB || 15;
const GAME_STATE_KEY_LENGTH = process.env.GAME_STATE_KEY_LENGTH || 4;
const DB_CHECK_INTERVAL = process.env.DB_CHECK_INTERVAL || 3600000; // 1 hour

// Debug mode flag - enables additional logging
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

/**
 * Database Configuration
 * Primary: PostgreSQL with connection pooling
 * Fallback: SQLite for local development or if PostgreSQL is unavailable
 */

// PostgreSQL connection pool
let pgPool = null;
let usingPostgres = false;

// SQLite database path and instance
const dbFilePath = path.join(__dirname, 'database/db.sqlite');
let sqliteDb = null;
let isDatabaseCapacityReached = false;

/**
 * Enhanced logging function with DEBUG_MODE support
 * @param {string} message - Log message
 * @param {string} level - Log level (info, warn, error, debug)
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  
  switch (level) {
    case 'error':
      console.error(`[${timestamp}] ERROR: ${message}`);
      break;
    case 'warn':
      console.warn(`[${timestamp}] WARNING: ${message}`);
      break;
    case 'debug':
      if (DEBUG_MODE) {
        console.log(`[${timestamp}] DEBUG: ${message}`);
      }
      break;
    default:
      console.log(`[${timestamp}] INFO: ${message}`);
  }
}

/**
 * Initialize PostgreSQL connection with optimized settings
 * @returns {boolean} Success status
 */
function initializePostgres() {
  const postgresUrl = process.env.DATABASE_POSTGRES_URL;
  
  if (!postgresUrl) {
    log('No PostgreSQL connection string found in environment variables', 'warn');
    return false;
  }
  
  try {
    log('Initializing PostgreSQL connection...');
    
    // Enhanced connection pool with better error handling
    pgPool = new pg.Pool({
      connectionString: postgresUrl,
      ssl: {
        rejectUnauthorized: process.env.POSTGRES_REJECT_UNAUTHORIZED !== 'false'
      },
      max: POSTGRES_POOL_SIZE, // Maximum clients in the pool
      idleTimeoutMillis: POSTGRES_IDLE_TIMEOUT, // How long a client is allowed to remain idle
      connectionTimeoutMillis: POSTGRES_CONNECTION_TIMEOUT, // How long to wait for a connection
      application_name: 'ptcg-sim-meta', // Helps identify connections in PostgreSQL logs
    });
    
    // Handle pool errors to prevent application crashes
    pgPool.on('error', (err) => {
      log(`Unexpected PostgreSQL pool error: ${err.message}`, 'error');
      log(`Error details: ${JSON.stringify(err)}`, 'debug');
      
      // If the PostgreSQL connection fails, we can fall back to SQLite
      if (usingPostgres) {
        log('PostgreSQL connection lost, falling back to SQLite', 'warn');
        usingPostgres = false;
        
        // Make sure SQLite is initialized
        if (!sqliteDb) {
          initializeSQLite();
        }
      }
    });
    
    // Test connection and create tables
    pgPool.connect((err, client, release) => {
      if (err) {
        log(`Error connecting to PostgreSQL: ${err.message}`, 'error');
        log('Will fall back to SQLite database', 'warn');
        return;
      }
      
      log('Successfully connected to PostgreSQL database!');
      usingPostgres = true;
      
      // Create tables if they don't exist
      client.query(`
        CREATE TABLE IF NOT EXISTS key_value_pairs (
          key TEXT PRIMARY KEY,
          value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          accessed_at TIMESTAMP,
          size_bytes BIGINT
        )
      `, (err) => {
        if (err) {
          log(`Error creating PostgreSQL tables: ${err.message}`, 'error');
        } else {
          log('PostgreSQL tables initialized');
          
          // Create index for faster querying
          client.query(`
            CREATE INDEX IF NOT EXISTS idx_key_value_pairs_created_at 
            ON key_value_pairs (created_at)
          `, (indexErr) => {
            if (indexErr) {
              log(`Error creating index: ${indexErr.message}`, 'warn');
            } else {
              log('PostgreSQL indices initialized');
            }
          });
          
          // Set up automatic cleanup of old records
          setupAutomaticCleanup(client);
        }
        release();
      });
    });
    
    return true;
  } catch (error) {
    log(`Error initializing PostgreSQL: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Set up automatic cleanup of old game states
 * @param {Object} client - PostgreSQL client
 */
function setupAutomaticCleanup(client) {
  // Keep records for 30 days by default
  const retentionDays = process.env.POSTGRES_RETENTION_DAYS || 30;
  
  // Create a function for cleanup
  client.query(`
    CREATE OR REPLACE FUNCTION cleanup_old_game_states()
    RETURNS void AS $$
    BEGIN
      DELETE FROM key_value_pairs 
      WHERE created_at < NOW() - INTERVAL '${retentionDays} days';
    END;
    $$ LANGUAGE plpgsql;
  `, (err) => {
    if (err) {
      log(`Error creating cleanup function: ${err.message}`, 'warn');
    } else {
      log(`Automatic cleanup configured for records older than ${retentionDays} days`);
    }
  });
}

/**
 * Initialize SQLite database as fallback or primary storage
 */
function initializeSQLite() {
  try {
    log('Initializing SQLite database...');
    
    // Ensure database directory exists
    const dbDir = path.dirname(dbFilePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      log(`Created database directory: ${dbDir}`);
    }
    
    sqliteDb = new sqlite3.Database(dbFilePath, (err) => {
      if (err) {
        log(`Error opening SQLite database: ${err.message}`, 'error');
        return;
      }
      
      log('Connected to SQLite database');
      
      // Create more robust table with additional metadata
      sqliteDb.run(
        `CREATE TABLE IF NOT EXISTS KeyValuePairs (
          key TEXT PRIMARY KEY, 
          value TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          accessed_at INTEGER,
          size_bytes INTEGER
        )`,
        (err) => {
          if (err) {
            log(`Error creating SQLite table: ${err.message}`, 'error');
          } else {
            log('SQLite tables initialized');
            
            // Create index for faster querying
            sqliteDb.run(
              'CREATE INDEX IF NOT EXISTS idx_key_value_pairs_created_at ON KeyValuePairs (created_at)',
              (indexErr) => {
                if (indexErr) {
                  log(`Error creating SQLite index: ${indexErr.message}`, 'warn');
                } else {
                  log('SQLite indices initialized');
                }
              }
            );
          }
        }
      );
    });
  } catch (error) {
    log(`Error initializing SQLite: ${error.message}`, 'error');
  }
}

/**
 * Check SQLite database size with error handling
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
      log(`Error checking database size: ${error.message}`, 'error');
      return 0;
    }
  }
  return 0;
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
 * @param {string} database - Database to update ('postgres' or 'sqlite')
 */
async function updateAccessTimestamp(key, database) {
  try {
    if (database === 'postgres' && pgPool) {
      await pgPool.query(
        'UPDATE key_value_pairs SET accessed_at = NOW() WHERE key = $1',
        [key]
      );
      log(`Updated access timestamp for key ${key} in PostgreSQL`, 'debug');
    } else if (database === 'sqlite' && sqliteDb) {
      sqliteDb.run(
        'UPDATE KeyValuePairs SET accessed_at = strftime("%s", "now") WHERE key = ?',
        [key],
        (err) => {
          if (err) {
            log(`Error updating SQLite access timestamp: ${err.message}`, 'warn');
          } else {
            log(`Updated access timestamp for key ${key} in SQLite`, 'debug');
          }
        }
      );
    }
  } catch (error) {
    log(`Error updating access timestamp: ${error.message}`, 'warn');
  }
}

/**
 * Perform manual cleanup of old records
 * @param {number} days - Days to keep records for
 */
async function cleanupOldRecords(days = 30) {
  const timestamp = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
  
  try {
    if (usingPostgres && pgPool) {
      const result = await pgPool.query(
        'DELETE FROM key_value_pairs WHERE created_at < NOW() - INTERVAL $1 DAY RETURNING COUNT(*)',
        [days]
      );
      log(`Cleaned up ${result.rowCount} old records from PostgreSQL`);
    }
    
    if (sqliteDb) {
      sqliteDb.run(
        'DELETE FROM KeyValuePairs WHERE created_at < ?',
        [timestamp],
        function(err) {
          if (err) {
            log(`Error cleaning up SQLite records: ${err.message}`, 'error');
          } else {
            log(`Cleaned up ${this.changes} old records from SQLite`);
          }
        }
      );
    }
  } catch (error) {
    log(`Error during cleanup: ${error.message}`, 'error');
  }
}

/**
 * Main application function
 */
async function main() {
  log('Starting PTCG-Sim-Meta server...');
  
  // Initialize databases with priority for PostgreSQL
  const postgresInitialized = initializePostgres();
  if (!postgresInitialized) {
    log('Using SQLite as primary database', 'warn');
    initializeSQLite();
  } else {
    log('Using PostgreSQL as primary database with SQLite fallback');
    
    // Initialize SQLite as fallback
    if (process.env.DISABLE_SQLITE_FALLBACK !== 'true') {
      initializeSQLite();
    } else {
      log('SQLite fallback is disabled by configuration');
    }
  }
  
  // Check SQLite database size periodically
  setInterval(() => {
    try {
      if (fs.existsSync(dbFilePath)) {
        const currentSize = checkDatabaseSizeGB();
        log(`Current SQLite database size: ${currentSize.toFixed(2)} GB`, 'debug');
        
        if (currentSize > SQLITE_MAX_SIZE_GB) {
          isDatabaseCapacityReached = true;
          log(`SQLite database size limit reached (${currentSize.toFixed(2)} GB > ${SQLITE_MAX_SIZE_GB} GB)`, 'warn');
        }
      }
    } catch (error) {
      log(`Error checking database size: ${error.message}`, 'error');
    }
    
    // Also perform periodic cleanup of old records
    if (process.env.ENABLE_AUTO_CLEANUP === 'true') {
      const retentionDays = process.env.RETENTION_DAYS || 30;
      cleanupOldRecords(retentionDays);
    }
  }, DB_CHECK_INTERVAL);
  
  // Initialize Express application
  const app = express();
  
  // Enable JSON body parsing for POST requests
  app.use(express.json({ limit: '50mb' })); // Increased limit for large game states
  
  const server = http.createServer(app);
  
  // Enhanced Socket.IO setup with comprehensive CORS configuration
  const io = new Server(server, {
    connectionStateRecovery: {
      // Enhanced recovery options
      maxDisconnectionDuration: 30000,
      skipMiddlewares: true,
    },
    cors: {
      // Allow connections from all relevant domains
      origin: [
        // Cloudflare Pages domains
        "https://ptcg-sim-meta.pages.dev",
        "https://ptcg-sim-meta-dev.pages.dev",
        
        // Render domains
        "https://ptcg-sim-meta.onrender.com",
        "https://ptcg-sim-meta-dev.onrender.com",
        
        // Local development
        "http://localhost:3000",
        "http://localhost:4000"
      ],
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true
    },
    // Additional Socket.IO options for better performance
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  
  // Bcrypt Configuration with fallback
  const saltRounds = 10;
  const plainPassword = process.env.ADMIN_PASSWORD || 'defaultPassword';
  if (process.env.ADMIN_PASSWORD === undefined) {
    log('No ADMIN_PASSWORD environment variable set, using default password', 'warn');
  }
  const hashedPassword = bcrypt.hashSync(plainPassword, saltRounds);
  
  // Socket.IO Admin Instrumentation with better security
  instrument(io, {
    auth: {
      type: 'basic',
      username: process.env.ADMIN_USERNAME || 'admin',
      password: hashedPassword,
    },
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    namespaceName: '/admin',
  });
  
  // Comprehensive CORS Configuration for Express
  // This should match Socket.IO CORS configuration
  const allowedOrigins = [
    'https://ptcg-sim-meta.pages.dev',
    'https://ptcg-sim-meta-dev.pages.dev',
    'https://ptcg-sim-meta.onrender.com',
    'https://ptcg-sim-meta-dev.onrender.com',
    'http://localhost:3000',
    'http://localhost:4000'
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
        log(`CORS blocked request from origin: ${origin}`, 'warn');
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // Cache preflight requests for 24 hours
  }));
  
  // Serve static files from client directory
  app.use(express.static(clientDir));
  
  // Simple request logging middleware
  app.use((req, res, next) => {
    log(`${req.method} ${req.url}`, 'debug');
    next();
  });
  
  // Add health check endpoint for monitoring
  app.get('/health', (req, res) => {
    const dbStatus = {
      postgres: usingPostgres ? 'connected' : 'disconnected',
      sqlite: sqliteDb ? 'connected' : 'disconnected',
    };
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      version: process.env.npm_package_version || '1.0.0',
    });
  });
  
  // Main application route
  app.get('/', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });
  
  // Import page route
  app.get('/import', (req, res) => {
    const key = req.query.key;
    if (!key) {
      return res.status(400).json({ 
        success: false,
        error: 'Key parameter is missing' 
      });
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });
  
  /**
   * API endpoint to retrieve game state data by key
   * Enhanced with better error handling and fallback strategy
   */
  app.get('/api/importData', async (req, res) => {
    log('Received request for /api/importData');
    
    const key = req.query.key;
    if (!key) {
      log('Request missing key parameter', 'warn');
      return res.status(400).json({ 
        success: false,
        error: 'Key parameter is missing' 
      });
    }
    
    log(`Looking up game state with key: ${key}`);
    
    try {
      // Try PostgreSQL first if available
      if (usingPostgres && pgPool) {
        try {
          log('Querying PostgreSQL database...', 'debug');
          const result = await pgPool.query(
            'SELECT value FROM key_value_pairs WHERE key = $1',
            [key]
          );
          
          if (result.rows.length > 0) {
            try {
              log('Found game state in PostgreSQL');
              
              // Update access timestamp
              updateAccessTimestamp(key, 'postgres');
              
              // Parse and return the JSON data
              const jsonData = JSON.parse(result.rows[0].value);
              return res.json(jsonData);
            } catch (parseError) {
              log(`Error parsing JSON data from PostgreSQL: ${parseError.message}`, 'error');
              return res.status(500).json({ 
                success: false,
                error: 'Error parsing game state data' 
              });
            }
          } else {
            log('Key not found in PostgreSQL, trying SQLite...', 'debug');
          }
        } catch (pgError) {
          log(`PostgreSQL query error: ${pgError.message}`, 'error');
          log('Falling back to SQLite database...', 'warn');
        }
      }
      
      // If PostgreSQL is not available or the key wasn't found, try SQLite
      if (sqliteDb) {
        log('Querying SQLite database...', 'debug');
        sqliteDb.get('SELECT value FROM KeyValuePairs WHERE key = ?', [key], (err, row) => {
          if (err) {
            log(`SQLite query error: ${err.message}`, 'error');
            return res.status(500).json({ 
              success: false,
              error: 'Database error' 
            });
          }
          
          if (row) {
            try {
              log('Found game state in SQLite');
              
              // Update access timestamp
              updateAccessTimestamp(key, 'sqlite');
              
              // Parse and return the JSON data
              const jsonData = JSON.parse(row.value);
              return res.json(jsonData);
            } catch (parseError) {
              log(`Error parsing JSON data from SQLite: ${parseError.message}`, 'error');
              return res.status(500).json({ 
                success: false,
                error: 'Error parsing game state data' 
              });
            }
          } else {
            log(`Game state with key ${key} not found in either database`, 'warn');
            return res.status(404).json({ 
              success: false,
              error: 'Game state not found' 
            });
          }
        });
      } else {
        // Neither database is available
        log('No database connection available', 'error');
        return res.status(500).json({ 
          success: false,
          error: 'Database connection error' 
        });
      }
    } catch (error) {
      log(`Unexpected error in /api/importData: ${error.message}`, 'error');
      return res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
      });
    }
  });
  
  /**
   * API endpoint to store game state data with a key
   * This allows direct HTTP storage without using Socket.IO
   */
  app.post('/api/storeGameState', async (req, res) => {
    log('Received POST request for /api/storeGameState');
    
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
      const key = req.body.key || generateRandomKey(GAME_STATE_KEY_LENGTH);
      const gameStateData = JSON.stringify(req.body.gameState);
      
      log(`Generated key for game state: ${key}`, 'debug');
      
      // Calculate size for metrics
      const sizeBytes = Buffer.byteLength(gameStateData, 'utf8');
      
      // Try to store in PostgreSQL first if available
      if (usingPostgres && pgPool) {
        try {
          log('Storing game state in PostgreSQL...', 'debug');
          await pgPool.query(
            `INSERT INTO key_value_pairs (key, value, created_at, accessed_at, size_bytes) 
             VALUES ($1, $2, NOW(), NOW(), $3) 
             ON CONFLICT (key) DO UPDATE 
             SET value = $2, created_at = NOW(), accessed_at = NOW(), size_bytes = $3`,
            [key, gameStateData, sizeBytes]
          );
          
          log(`Game state with key ${key} successfully stored in PostgreSQL`);
          return res.json({
            success: true,
            key: key
          });
        } catch (pgError) {
          log(`PostgreSQL error storing game state: ${pgError.message}`, 'error');
          log('Falling back to SQLite storage...', 'warn');
        }
      }
      
      // If PostgreSQL is not available or failed, use SQLite
      if (sqliteDb) {
        if (isDatabaseCapacityReached) {
          log('SQLite database capacity reached, cannot store game state', 'warn');
          return res.status(507).json({
            success: false,
            error: 'Database storage limit reached. Please try exporting as a file instead.'
          });
        } else {
          log('Storing game state in SQLite...', 'debug');
          
          // Use promises for better error handling
          const storeInSQLite = () => {
            return new Promise((resolve, reject) => {
              const now = Math.floor(Date.now() / 1000);
              
              sqliteDb.run(
                `INSERT OR REPLACE INTO KeyValuePairs (key, value, created_at, accessed_at, size_bytes) 
                 VALUES (?, ?, ?, ?, ?)`,
                [key, gameStateData, now, now, sizeBytes],
                function(err) {
                  if (err) {
                    reject(err);
                  } else {
                    resolve(this.changes);
                  }
                }
              );
            });
          };
          
          try {
            await storeInSQLite();
            log(`Game state with key ${key} successfully stored in SQLite`);
            
            return res.json({
              success: true,
              key: key
            });
          } catch (sqliteError) {
            log(`SQLite error storing game state: ${sqliteError.message}`, 'error');
            
            return res.status(500).json({
              success: false,
              error: 'Error storing game state in database'
            });
          }
        }
      } else {
        // Neither database is available
        log('No database connection available for storing game state', 'error');
        
        return res.status(500).json({
          success: false,
          error: 'Database connection error'
        });
      }
    } catch (error) {
      log(`Unexpected error in /api/storeGameState: ${error.message}`, 'error');
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });
  
  /**
   * API endpoint to delete a game state
   */
  app.delete('/api/gameState/:key', async (req, res) => {
    const key = req.params.key;
    
    try {
      let deleted = false;
      
      // Try PostgreSQL first
      if (usingPostgres && pgPool) {
        const result = await pgPool.query(
          'DELETE FROM key_value_pairs WHERE key = $1',
          [key]
        );
        
        if (result.rowCount > 0) {
          deleted = true;
          log(`Deleted game state ${key} from PostgreSQL`);
        }
      }
      
      // Also try SQLite
      if (sqliteDb) {
        const deleteSQLite = () => {
          return new Promise((resolve, reject) => {
            sqliteDb.run('DELETE FROM KeyValuePairs WHERE key = ?', [key], function(err) {
              if (err) {
                reject(err);
              } else {
                resolve(this.changes);
              }
            });
          });
        };
        
        try {
          const changes = await deleteSQLite();
          if (changes > 0) {
            deleted = true;
            log(`Deleted game state ${key} from SQLite`);
          }
        } catch (sqliteError) {
          log(`SQLite error deleting game state: ${sqliteError.message}`, 'error');
        }
      }
      
      if (deleted) {
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
      log(`Cleaned up ${deletedRooms} empty rooms`, 'debug');
    }
  };
  
  // Set up a timer to clean up empty rooms every 5 minutes
  setInterval(cleanUpEmptyRooms, 300000);
  
  // Socket.IO Connection Handling
  io.on('connection', async (socket) => {
    log(`New socket connection: ${socket.id}`, 'debug');
    
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
     * Enhanced game state storage handler
     * - Improved error handling
     * - Detailed logging
     * - Storage metrics for monitoring
     */
    socket.on('storeGameState', async (exportData) => {
      log('Received storeGameState request');
      
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
        const key = generateRandomKey(GAME_STATE_KEY_LENGTH);
        log(`Generated key for game state: ${key}`, 'debug');
        
        // Calculate size for metrics
        const sizeBytes = Buffer.byteLength(exportData, 'utf8');
        log(`Game state size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`, 'debug');
        
        // Check if game state is too large
        const maxSizeMB = process.env.MAX_GAME_STATE_SIZE_MB || 50;
        if (sizeBytes > maxSizeMB * 1024 * 1024) {
          log(`Game state too large: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB > ${maxSizeMB} MB`, 'warn');
          socket.emit(
            'exportGameStateFailed',
            `Game state too large (${(sizeBytes / 1024 / 1024).toFixed(2)} MB). Please try exporting as a file instead.`
          );
          return;
        }
        
        // Try to store in PostgreSQL first if available
        if (usingPostgres && pgPool) {
          try {
            log('Storing game state in PostgreSQL...', 'debug');
            await pgPool.query(
              `INSERT INTO key_value_pairs (key, value, created_at, accessed_at, size_bytes) 
               VALUES ($1, $2, NOW(), NOW(), $3) 
               ON CONFLICT (key) DO UPDATE 
               SET value = $2, created_at = NOW(), accessed_at = NOW(), size_bytes = $3`,
              [key, exportData, sizeBytes]
            );
            
            socket.emit('exportGameStateSuccessful', key);
            log(`Game state with key ${key} successfully stored in PostgreSQL`);
            return;
          } catch (pgError) {
            log(`PostgreSQL error storing game state: ${pgError.message}`, 'error');
            log('Falling back to SQLite storage...', 'warn');
          }
        }
        
        // If PostgreSQL is not available or failed, use SQLite
        if (sqliteDb) {
          if (isDatabaseCapacityReached) {
            log('SQLite database capacity reached, cannot store game state', 'warn');
            socket.emit(
              'exportGameStateFailed',
              'Database storage limit reached. Please try exporting as a file instead.'
            );
          } else {
            log('Storing game state in SQLite...', 'debug');
            const now = Math.floor(Date.now() / 1000);
            
            sqliteDb.run(
              `INSERT OR REPLACE INTO KeyValuePairs (key, value, created_at, accessed_at, size_bytes) 
               VALUES (?, ?, ?, ?, ?)`,
              [key, exportData, now, now, sizeBytes],
              function(err) {
                if (err) {
                  log(`SQLite error storing game state: ${err.message}`, 'error');
                  socket.emit(
                    'exportGameStateFailed',
                    'Error exporting game! Please try again or save as a file.'
                  );
                } else {
                  socket.emit('exportGameStateSuccessful', key);
                  log(`Game state with key ${key} successfully stored in SQLite`);
                }
              }
            );
          }
        } else {
          log('No database connection available for storing game state', 'error');
          socket.emit(
            'exportGameStateFailed',
            'Database connection error. Please try exporting as a file instead.'
          );
        }
      } catch (error) {
        log(`Unexpected error in storeGameState handler: ${error.message}`, 'error');
        socket.emit(
          'exportGameStateFailed',
          'An unexpected error occurred. Please try exporting as a file instead.'
        );
      }
    });
    
    /**
     * Enhanced room joining handler with better error handling
     */
    socket.on('joinGame', (roomId, username, isSpectator) => {
      // Validate inputs
      if (!roomId || typeof roomId !== 'string') {
        log('Invalid roomId in joinGame request', 'warn');
        socket.emit('roomReject', 'Invalid room ID');
        return;
      }
      
      if (!username || typeof username !== 'string') {
        log('Invalid username in joinGame request', 'warn');
        socket.emit('roomReject', 'Invalid username');
        return;
      }
      
      log(`User ${username} attempting to join room ${roomId}${isSpectator ? ' as spectator' : ''}`);
      
      if (!roomInfo.has(roomId)) {
        roomInfo.set(roomId, { 
          players: new Set(), 
          spectators: new Set(),
          created: new Date().toISOString()
        });
        log(`Created new room: ${roomId}`);
      }
      
      const room = roomInfo.get(roomId);

      if (room.players.size < 2 || isSpectator) {
        socket.join(roomId);
        log(`User ${username} joined room ${roomId}`);
        
        // Check if the user is a spectator or there are fewer than 2 players
        if (isSpectator) {
          room.spectators.add(username);
          socket.emit('spectatorJoin');
          log(`User ${username} joined as spectator`);
        } else {
          room.players.add(username);
          socket.emit('joinGame');
          log(`User ${username} joined as player (${room.players.size}/2 players)`);
          
          socket.data.disconnectListener = () =>
            disconnectHandler(roomId, username);
          socket.on('disconnect', socket.data.disconnectListener);
        }
      } else {
        socket.emit('roomReject', 'Room is full');
        log(`User ${username} rejected from full room ${roomId}`);
      }
    });
    
    /**
     * Enhanced user reconnection handler
     */
    socket.on('userReconnected', (data) => {
      // Validate data
      if (!data || !data.roomId || !data.username) {
        log('Invalid data in userReconnected request', 'warn');
        return;
      }
      
      log(`User ${data.username} reconnecting to room ${data.roomId}`);
      
      if (!roomInfo.has(data.roomId)) {
        roomInfo.set(data.roomId, {
          players: new Set(),
          spectators: new Set(),
          created: new Date().toISOString()
        });
        log(`Created new room for reconnection: ${data.roomId}`);
      }
      
      const room = roomInfo.get(data.roomId);
      socket.join(data.roomId);
      
      if (!data.notSpectator) {
        room.spectators.add(data.username);
        log(`User ${data.username} reconnected as spectator`);
      } else {
        room.players.add(data.username);
        log(`User ${data.username} reconnected as player`);
        
        socket.data.disconnectListener = () =>
          disconnectHandler(data.roomId, data.username);
        socket.on('disconnect', socket.data.disconnectListener);
        io.to(data.roomId).emit('userReconnected', data);
      }
    });
    
    // List of socket events to forward with improved logging
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
        if (DEBUG_MODE) {
          log(`Forwarding ${event} event to room ${data?.roomId || 'unknown'}`, 'debug');
        }
        emitToRoom(event, data);
      });
    }
    
    // Handle socket disconnection with improved error handling
    socket.on('disconnect', (reason) => {
      log(`Socket disconnected: ${socket.id}, reason: ${reason}`, 'debug');
    });
    
    // Handle socket errors
    socket.on('error', (error) => {
      log(`Socket error: ${error.message}`, 'error');
    });
  });
  
  // Get port from environment variable or use default
  const port = DEFAULT_PORT;
  
  // Start the server with error handling
  try {
    server.listen(port, () => {
      log(`✨ PTCG-Sim-Meta server is running at http://localhost:${port}`);
      log(`💾 Using ${usingPostgres ? 'PostgreSQL' : 'SQLite'} as primary database`);
      
      // Log environment information for debugging
      log(`Node.js version: ${process.version}`, 'debug');
      log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'debug');
      log(`Debug mode: ${DEBUG_MODE ? 'enabled' : 'disabled'}`, 'debug');
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

// Start the application with improved error handling
main().catch(error => {
  log(`Fatal error starting server: ${error.message}`, 'error');
  
  // Log stack trace in debug mode
  if (DEBUG_MODE) {
    log(`Stack trace: ${error.stack}`, 'debug');
  }
  
  process.exit(1);
});