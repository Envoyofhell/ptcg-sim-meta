// workers/gamestate.js
/**
 * Functions to manage game state in D1 database
 */

/**
 * Stores game state in D1 database
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} key - Unique key for the game state
 * @param {string} data - JSON string of game state data
 * @returns {Promise<boolean>} - Whether the operation succeeded
 */
export async function storeGameState(env, key, data) {
  if (!env.DB) {
    console.error('D1 database binding not available');
    return false;
  }

  try {
    console.log(`Storing game state with key: ${key}`);

    // Prepare and execute the D1 query
    const stmt = env.DB.prepare(
      'INSERT OR REPLACE INTO KeyValuePairs (key, value) VALUES (?, ?)'
    ).bind(key, data);
    const result = await stmt.run();

    if (result.error) {
      console.error('D1 database error:', result.error);
      return false;
    }

    console.log(`Game state stored successfully with key: ${key}`);
    return true;
  } catch (error) {
    console.error(`Error storing game state: ${error.message}`);
    return false;
  }
}

/**
 * Retrieves game state from D1 database
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} key - Key for the game state to retrieve
 * @returns {Promise<string|null>} - Game state data or null if not found
 */
export async function getGameState(env, key) {
  if (!env.DB) {
    console.error('D1 database binding not available');
    return null;
  }

  try {
    console.log(`Retrieving game state with key: ${key}`);

    // Prepare and execute the D1 query
    const stmt = env.DB.prepare(
      'SELECT value FROM KeyValuePairs WHERE key = ?'
    ).bind(key);
    const result = await stmt.first();

    if (!result) {
      console.log(`No game state found for key: ${key}`);
      return null;
    }

    return result.value;
  } catch (error) {
    console.error(`Error retrieving game state: ${error.message}`);
    return null;
  }
}

/**
 * Generates a random key of specified length
 *
 * @param {number} length - Length of key to generate
 * @returns {string} - Random key
 */
export function generateRandomKey(length) {
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
 * Cleans up old game states from the database
 * (Could be called periodically to prevent database growth)
 *
 * @param {Object} env - Worker environment bindings
 * @param {number} maxAgeHours - Maximum age in hours to keep game states
 * @returns {Promise<number>} - Number of records deleted
 */
export async function cleanupOldGameStates(env, maxAgeHours = 24) {
  if (!env.DB) {
    console.error('D1 database binding not available');
    return 0;
  }

  try {
    // Create a timestamp column if it doesn't exist
    // Note: This is a simplification - in a real implementation,
    // you would need to track timestamps separately

    // For this example, we'll just delete a percentage of old records
    // to prevent database growth
    const result = await env.DB.prepare(
      'DELETE FROM KeyValuePairs WHERE rowid IN (SELECT rowid FROM KeyValuePairs ORDER BY rowid LIMIT (SELECT COUNT(*) * 0.1 FROM KeyValuePairs))'
    ).run();

    return result.changes || 0;
  } catch (error) {
    console.error(`Error cleaning up old game states: ${error.message}`);
    return 0;
  }
}
