// server/services/game-state.js
import { getDatabaseConnection } from '../config/database.js';

/**
 * Store game state in the database
 * 
 * @param {string} data - Game state data to store
 * @param {string} key - Unique key for the game state
 * @returns {Object} - Storage result
 */
export async function storeGameState(data, key) {
  try {
    const db = getDatabaseConnection();
    
    if (!db) {
      return { 
        success: false, 
        error: 'Database connection unavailable' 
      };
    }
    
    // PostgreSQL implementation
    await db.query(
      `INSERT INTO key_value_pairs (key, value, created_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) DO UPDATE 
       SET value = $2, created_at = NOW()`,
      [key, data]
    );
    
    return { success: true, key };
  } catch (error) {
    console.error('Error storing game state:', error);
    return { 
      success: false, 
      error: 'Database error occurred while storing game state' 
    };
  }
}

/**
 * Retrieve game state from the database
 * 
 * @param {string} key - Key for the game state to retrieve
 * @returns {Object} - Retrieved game state or error
 */
export async function getGameState(key) {
  try {
    const db = getDatabaseConnection();
    
    if (!db) {
      return { 
        success: false, 
        error: 'Database connection unavailable' 
      };
    }
    
    // PostgreSQL implementation
    const result = await db.query(
      'SELECT value FROM key_value_pairs WHERE key = $1',
      [key]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Game state not found' };
    }
    
    return { success: true, data: result.rows[0].value };
  } catch (error) {
    console.error('Error retrieving game state:', error);
    return { 
      success: false, 
      error: 'Database error occurred while retrieving game state' 
    };
  }
}

/**
 * Delete a game state from the database
 * 
 * @param {string} key - Key for the game state to delete
 * @returns {Object} - Deletion result
 */
export async function deleteGameState(key) {
  try {
    const db = getDatabaseConnection();
    
    if (!db) {
      return { 
        success: false, 
        error: 'Database connection unavailable' 
      };
    }
    
    // PostgreSQL implementation
    const result = await db.query(
      'DELETE FROM key_value_pairs WHERE key = $1',
      [key]
    );
    
    if (result.rowCount === 0) {
      return { success: false, error: 'Game state not found' };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting game state:', error);
    return { 
      success: false, 
      error: 'Database error occurred while deleting game state' 
    };
  }
}