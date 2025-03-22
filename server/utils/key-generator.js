/**
 * Key generator utility for PTCG-Sim-Meta
 * Generates random keys for game state storage
 */

/**
 * Generate a random alphanumeric key
 * 
 * @param {number} length - Length of the key to generate
 * @returns {string} - Random alphanumeric key
 */
export function generateRandomKey(length = 4) {
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
   * Generate a key with specific prefix
   * Useful for categorizing different types of saved states
   * 
   * @param {string} prefix - Prefix to add to the key
   * @param {number} length - Length of the random portion of the key
   * @returns {string} - Key with prefix
   */
  export function generatePrefixedKey(prefix, length = 4) {
    return `${prefix}_${generateRandomKey(length)}`;
  }
  
  /**
   * Validate that a key has the expected format
   * 
   * @param {string} key - Key to validate
   * @param {number} expectedLength - Expected length of key
   * @returns {boolean} - True if key is valid
   */
  export function isValidKey(key, expectedLength = 4) {
    // Check if key is a string
    if (typeof key !== 'string') {
      return false;
    }
    
    // Check if key has the expected length
    if (key.length !== expectedLength) {
      return false;
    }
    
    // Check if key contains only alphanumeric characters
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    return alphanumericRegex.test(key);
  }