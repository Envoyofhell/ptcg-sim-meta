/**
 * Game state database operations
 * 
 * This module handles all database interactions for game state
 * storage, retrieval, and management.
 */
import { getDbClient } from './client';
import { log } from '../utils/logging.js';

/**
 * Retrieve a game state by key
 * 
 * @param {Object} env - Environment variables
 * @param {string} key - Game state key
 * @returns {Object} Game state data and metadata
 */
export async function getGameStateByKey(env, key) {
  const pool = getDbClient(env);
  
  try {
    // Query the database for the game state
    const result = await pool.query(
      'SELECT value, created_at, accessed_at, size_bytes, metadata FROM key_value_pairs WHERE key = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      return { found: false };
    }
    
    // Update accessed_at timestamp
    await updateAccessTimestamp(env, key);
    
    // Return the game state data and metadata
    return {
      found: true,
      value: result.rows[0].value,
      created_at: result.rows[0].created_at,
      accessed_at: result.rows[0].accessed_at,
      size_bytes: result.rows[0].size_bytes,
      metadata: result.rows[0].metadata
    };
  } catch (error) {
    log(`Error retrieving game state: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Store a game state
 * 
 * @param {Object} env - Environment variables
 * @param {string} key - Game state key
 * @param {string} value - Game state data
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Result with key and size
 */
export async function storeGameState(env, key, value, metadata = {}) {
  const pool = getDbClient(env);
  
  try {
    // Calculate size in bytes
    const sizeBytes = new TextEncoder().encode(value).length;
    
    // Store the game state
    await pool.query(
      `INSERT INTO key_value_pairs (key, value, created_at, accessed_at, size_bytes, metadata) 
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3, $4) 
       ON CONFLICT (key) DO UPDATE 
       SET value = $2, accessed_at = CURRENT_TIMESTAMP, size_bytes = $3, metadata = $4`,
      [key, value, sizeBytes, JSON.stringify(metadata)]
    );
    
    log(`Stored game state with key ${key} (${sizeBytes} bytes)`, 'info');
    
    return {
      success: true,
      key: key,
      size_bytes: sizeBytes
    };
  } catch (error) {
    log(`Error storing game state: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Delete a game state by key
 * 
 * @param {Object} env - Environment variables
 * @param {string} key - Game state key
 * @returns {Object} Result with deletion status
 */
export async function deleteGameState(env, key) {
  const pool = getDbClient(env);
  
  try {
    // Delete the game state
    const result = await pool.query(
      'DELETE FROM key_value_pairs WHERE key = $1',
      [key]
    );
    
    return {
      success: true,
      deleted: result.rowCount > 0
    };
  } catch (error) {
    log(`Error deleting game state: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Update access timestamp for a game state
 * 
 * @param {Object} env - Environment variables
 * @param {string} key - Game state key
 */
export async function updateAccessTimestamp(env, key) {
  const pool = getDbClient(env);
  
  try {
    await pool.query(
      'UPDATE key_value_pairs SET accessed_at = CURRENT_TIMESTAMP WHERE key = $1',
      [key]
    );
    
    log(`Updated access timestamp for key ${key}`, 'debug');
  } catch (error) {
    log(`Error updating access timestamp: ${error.message}`, 'warn');
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Clean up old game states
 * 
 * @param {Object} env - Environment variables
 * @param {number} days - Number of days to keep game states
 * @returns {Object} Result with count of deleted records
 */
export async function cleanupOldGameStates(env, days = 30) {
  const pool = getDbClient(env);
  
  try {
    const result = await pool.query(
      `DELETE FROM key_value_pairs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${days} days'`
    );
    
    log(`Cleaned up ${result.rowCount} old game states`, 'info');
    
    return {
      success: true,
      count: result.rowCount
    };
  } catch (error) {
    log(`Error cleaning up old game states: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get database statistics
 * 
 * @param {Object} env - Environment variables
 * @returns {Object} Database statistics
 */
export async function getDatabaseStats(env) {
  const pool = getDbClient(env);
  
  try {
    // Get record count
    const countResult = await pool.query('SELECT COUNT(*) FROM key_value_pairs');
    
    // Get total size
    const sizeResult = await pool.query('SELECT SUM(size_bytes) FROM key_value_pairs');
    
    // Get oldest and newest records
    const oldestResult = await pool.query('SELECT MIN(created_at) FROM key_value_pairs');
    const newestResult = await pool.query('SELECT MAX(created_at) FROM key_value_pairs');
    
    // Get recently accessed records
    const recentResult = await pool.query(
      `SELECT COUNT(*) FROM key_value_pairs WHERE accessed_at > CURRENT_TIMESTAMP - INTERVAL '1 day'`
    );
    
    return {
      success: true,
      stats: {
        totalRecords: parseInt(countResult.rows[0].count, 10),
        totalSizeBytes: parseInt(sizeResult.rows[0].sum || '0', 10),
        oldestRecord: oldestResult.rows[0].min,
        newestRecord: newestResult.rows[0].max,
        recentlyAccessed: parseInt(recentResult.rows[0].count, 10)
      }
    };
  } catch (error) {
    log(`Error getting database stats: ${error.message}`, 'error');
    throw error;
  }
}