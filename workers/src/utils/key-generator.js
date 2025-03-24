/**
 * Key generator utilities
 *
 * This module provides functions for generating and validating
 * random keys used for game state identification.
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

  // Use crypto if available for better randomness
  const getRandomValue = () => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0] / (0xffffffff + 1);
    } else {
      return Math.random();
    }
  };

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(getRandomValue() * characters.length);
    key += characters.charAt(randomIndex);
  }

  return key;
}

/**
 * Generate a key with a specific prefix
 *
 * @param {string} prefix - Prefix for the key
 * @param {number} length - Length of the random part
 * @returns {string} Key with prefix
 */
export function generatePrefixedKey(prefix, length = 4) {
  return `${prefix}_${generateRandomKey(length)}`;
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

/**
 * Validate a prefixed key format
 *
 * @param {string} key - Key to validate
 * @param {string} prefix - Expected prefix
 * @param {number} length - Expected length of random part
 * @returns {boolean} Whether the key is valid
 */
export function isValidPrefixedKey(key, prefix, length = 4) {
  // Key must be a string
  if (typeof key !== 'string') {
    return false;
  }

  // Key must start with prefix followed by underscore
  if (!key.startsWith(`${prefix}_`)) {
    return false;
  }

  // Extract the random part
  const randomPart = key.substring(prefix.length + 1);

  // Validate the random part
  return isValidKey(randomPart, length);
}
