/**
 * Database configuration module for PTCG-Sim-Meta
 * Handles connections to PostgreSQL (Neon) database only
 */
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// PostgreSQL connection pool
let pgPool = null;

/**
 * Initialize and return a PostgreSQL connection pool
 */
export function initPostgres() {
  if (pgPool) return pgPool;
  
  const connectionString = process.env.DATABASE_POSTGRES_URL;
  
  if (!connectionString) {
    console.error('DATABASE_POSTGRES_URL environment variable not set');
    return null;
  }
  
  pgPool = new pg.Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false // Required for Neon
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  
  // Test connection on first use
  pgPool.on('connect', (client) => {
    console.log('Connected to PostgreSQL database');
  });
  
  pgPool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
  });
  
  return pgPool;
}

/**
 * Initialize database tables for PostgreSQL
 */
export async function initPostgresTables() {
  const pool = initPostgres();
  if (!pool) return false;
  
  try {
    const client = await pool.connect();
    try {
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS key_value_pairs (
          key TEXT PRIMARY KEY,
          value TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create index for faster cleanup
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_key_value_pairs_created_at 
        ON key_value_pairs (created_at)
      `);
      
      console.log('PostgreSQL tables initialized');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error initializing PostgreSQL tables:', error);
    return false;
  }
}

/**
 * Get the database connection (PostgreSQL only)
 */
export function getDatabaseConnection() {
  return initPostgres();
}

/**
 * Initialize the database system
 * Sets up PostgreSQL database
 */
export async function initializeDatabase() {
  console.log('Using PostgreSQL database');
  const pool = initPostgres();
  await initPostgresTables();
  return pool;
}