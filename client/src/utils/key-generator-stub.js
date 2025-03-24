/**
 * Stub key generator utility for PTCG-Sim-Meta
 * This file is loaded when the real key generator module can't be found
 * 
 * File: client/workers/src/utils/key-generator-stub.js
 */

/**
 * Generate a random alphanumeric key
 * 
 * @param {number} length - Length of the key
 * @returns {string} Random alphanumeric key
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
   * Validate a key format
   * 
   * @param {string} key - Key to validate
   * @param {number} length - Expected length
   * @returns {boolean} Whether the key is valid
   */
  export function isValidKey(key, length = 4) {
    // Key must be a string
    if (typeof key !== 'string') {
      return false;
    }
    
    // Key must be the right length
    if (key.length !== length) {
      return false;
    }
    
    // Key must contain only alphanumeric characters
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    return alphanumericRegex.test(key);
  }
  
  // For compatibility with both named and default exports
  export default { generateRandomKey, isValidKey };