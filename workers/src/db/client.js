/**
 * Database client configuration for Neon PostgreSQL
 * 
 * This module sets up the connection to Neon PostgreSQL database
 * using their serverless driver optimized for Cloudflare Workers.
 */
import { Pool } from '@neondatabase/serverless';
import { log } from '../utils/logging';

/**
 * Create a database pool using the provided connection string
 * 
 * @param {string} connectionString - Neon PostgreSQL connection string
 * @returns {Pool} Database connection pool
 */
export function createPool(connectionString) {
  if (!connectionString) {
    log('No database connection string provided', 'error');
    throw new Error('Database connection string is required');
  }
  
  // Log connection attempt with redacted password
  const redactedUrl = connectionString.replace(
    /postgresql:\/\/([^:]+):([^@]+)@/,
    'postgresql://$1:***@'
  );
  log(`Connecting to Neon PostgreSQL: ${redactedUrl}`, 'debug');
  
  // Create connection pool
  return new Pool({
    connectionString,
    ssl: true
  });
}

/**
 * Initialize database tables if they don't exist
 * 
 * @param {Pool} pool - Database connection pool
 */
export async function initializeTables(pool) {
  try {
    // Create the key_value_pairs table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS key_value_pairs (
        key TEXT PRIMARY KEY,
        value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        size_bytes BIGINT,
        metadata JSONB DEFAULT '{}'::jsonb
      )
    `);
    
    // Create indices for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_key_value_pairs_created_at 
      ON key_value_pairs (created_at)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_key_value_pairs_accessed_at 
      ON key_value_pairs (accessed_at)
    `);
    
    log('Database tables and indices initialized', 'info');
    return true;
  } catch (error) {
    log(`Error initializing database tables: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get database client from environment
 * 
 * @param {Object} env - Environment variables
 * @returns {Pool} Database connection pool
 */
export function getDbClient(env) {
  const connectionString = env.DATABASE_URL;
  return createPool(connectionString);
}