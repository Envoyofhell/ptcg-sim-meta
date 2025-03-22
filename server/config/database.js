/**
 * Database configuration module for PTCG-Sim-Meta
 * Handles connections to PostgreSQL (Neon) database
 * 
 * This module can be gradually integrated with your existing code
 * to transition from SQLite to PostgreSQL.
 */
import pg from 'pg';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Handle __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Path to SQLite database
const SQLITE_DB_PATH = path.join(__dirname, '../../database/db.sqlite');

// PostgreSQL connection pool
let pgPool = null;

// SQLite database connection
let sqliteDb = null;

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
 * Initialize and return a SQLite database connection
 */
export function initSqlite() {
  if (sqliteDb) return sqliteDb;
  
  // Create directory if it doesn't exist
  const dbDir = path.dirname(SQLITE_DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err);
      return null;
    }
    console.log('Connected to SQLite database');
    
    // Create table if it doesn't exist
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS KeyValuePairs (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
  });
  
  return sqliteDb;
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
 * Check if we should use PostgreSQL (based on environment)
 */
export function shouldUsePostgres() {
  // Check if PostgreSQL connection string is available
  return !!process.env.DATABASE_POSTGRES_URL;
}

/**
 * Get the appropriate database connection
 * Will use PostgreSQL if available, otherwise fallback to SQLite
 */
export function getDatabaseConnection() {
  if (shouldUsePostgres()) {
    return initPostgres();
  } else {
    return initSqlite();
  }
}

/**
 * Initialize the database system
 * Sets up the appropriate database based on environment
 */
export async function initializeDatabase() {
  if (shouldUsePostgres()) {
    console.log('Using PostgreSQL database');
    const pool = initPostgres();
    await initPostgresTables();
    return pool;
  } else {
    console.log('Using SQLite database');
    return initSqlite();
  }
}