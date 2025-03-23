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
    
    // Handle different database types
    if (db.query) {
      // PostgreSQL
      await db.query(
        `INSERT INTO key_value_pairs (key, value, created_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE 
         SET value = $2, created_at = NOW()`,
        [key, data]
      );
    } else {
      // SQLite
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO KeyValuePairs (key, value) VALUES (?, ?)`,
          [key, data],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
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
    
    // Handle different database types
    if (db.query) {
      // PostgreSQL
      const result = await db.query(
        'SELECT value FROM key_value_pairs WHERE key = $1',
        [key]
      );
      
      if (result.rows.length === 0) {
        return { success: false, error: 'Game state not found' };
      }
      
      return { success: true, data: result.rows[0].value };
    } else {
      // SQLite
      return await new Promise((resolve, reject) => {
        db.get(
          'SELECT value FROM KeyValuePairs WHERE key = ?',
          [key],
          (err, row) => {
            if (err) {
              reject(err);
            } else if (!row) {
              resolve({ success: false, error: 'Game state not found' });
            } else {
              resolve({ success: true, data: row.value });
            }
          }
        );
      });
    }
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
    
    // Handle different database types
    if (db.query) {
      // PostgreSQL
      const result = await db.query(
        'DELETE FROM key_value_pairs WHERE key = $1',
        [key]
      );
      
      if (result.rowCount === 0) {
        return { success: false, error: 'Game state not found' };
      }
      
      return { success: true };
    } else {
      // SQLite
      return await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM KeyValuePairs WHERE key = ?',
          [key],
          function(err) {
            if (err) {
              reject(err);
            } else if (this.changes === 0) {
              resolve({ success: false, error: 'Game state not found' });
            } else {
              resolve({ success: true });
            }
          }
        );
      });
    }
  } catch (error) {
    console.error('Error deleting game state:', error);
    return { 
      success: false, 
      error: 'Database error occurred while deleting game state' 
    };
  }
}