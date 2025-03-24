// workers/gamestate.js
// Functions to manage game state in D1 database

/**
 * Stores game state in D1 database
 */
export async function storeGameState(env, key, data) {
    try {
      const stmt = env.DB.prepare('INSERT OR REPLACE INTO KeyValuePairs (key, value) VALUES (?, ?)').bind(key, data);
      await stmt.run();
      return true;
    } catch (error) {
      console.error('Error storing game state:', error);
      return false;
    }
  }
  
  /**
   * Generates a random key of specified length
   */
  export function generateRandomKey(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      key += characters.charAt(randomIndex);
    }
    return key;
  }