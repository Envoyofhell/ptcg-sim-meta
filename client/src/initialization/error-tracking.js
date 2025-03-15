/**
 * Error Tracking Utility
 * Provides rate-limited logging to prevent console spam
 * 
 * This utility tracks error messages and ensures each unique message
 * is only logged a limited number of times to prevent console spam.
 */

// CONFIGURATION
// -------------
// Set this to false to disable all error and warning logs
export const ENABLE_ERROR_TRACKING = true;

// Set this to false to disable just the warnings (errors will still show)
export const ENABLE_WARNINGS = true;

// Maximum number of times to show each unique message
const MAX_LOGS = 3;
// -------------

// Track error counts by message
const errorCounts = new Map();
// Track warning counts by message
const warningCounts = new Map();

/**
 * Logs an error message with rate limiting
 * @param {string} message - The error message
 * @param {*} [details] - Optional details to include with the error
 * @returns {boolean} - True if the message was logged, false if suppressed
 */
export const logError = (message, details = undefined) => {
  // Check if error tracking is disabled
  if (!ENABLE_ERROR_TRACKING) {
    return false;
  }
  
  // Get current count for this message
  const count = errorCounts.get(message) || 0;
  
  // Update count for this message
  errorCounts.set(message, count + 1);
  
  // Only log the message if we haven't exceeded the maximum
  if (count < MAX_LOGS) {
    if (details) {
      console.error(`[${count + 1}/${MAX_LOGS}] ${message}`, details);
    } else {
      console.error(`[${count + 1}/${MAX_LOGS}] ${message}`);
    }
    return true;
  } else if (count === MAX_LOGS) {
    // Log a final message indicating further logs will be suppressed
    console.error(`[${MAX_LOGS}/${MAX_LOGS}] ${message} - Further occurrences will be suppressed`);
    return true;
  }
  
  // Message was suppressed
  return false;
};

/**
 * Logs a warning message with rate limiting
 * @param {string} message - The warning message
 * @param {*} [details] - Optional details to include with the warning
 * @returns {boolean} - True if the message was logged, false if suppressed
 */
export const logWarning = (message, details = undefined) => {
  // Check if error tracking or warnings are disabled
  if (!ENABLE_ERROR_TRACKING || !ENABLE_WARNINGS) {
    return false;
  }
  
  // Get current count for this message
  const count = warningCounts.get(message) || 0;
  
  // Update count for this message
  warningCounts.set(message, count + 1);
  
  // Only log the message if we haven't exceeded the maximum
  if (count < MAX_LOGS) {
    if (details) {
      console.warn(`[${count + 1}/${MAX_LOGS}] ${message}`, details);
    } else {
      console.warn(`[${count + 1}/${MAX_LOGS}] ${message}`);
    }
    return true;
  } else if (count === MAX_LOGS) {
    // Log a final message indicating further logs will be suppressed
    console.warn(`[${MAX_LOGS}/${MAX_LOGS}] ${message} - Further occurrences will be suppressed`);
    return true;
  }
  
  // Message was suppressed
  return false;
};

/**
 * Logs an info message (these are not rate-limited but can be disabled)
 * @param {string} message - The info message
 * @param {*} [details] - Optional details to include with the message
 */
export const logInfo = (message, details = undefined) => {
  // Check if error tracking is disabled
  if (!ENABLE_ERROR_TRACKING) {
    return false;
  }
  
  if (details) {
    console.log(`[INFO] ${message}`, details);
  } else {
    console.log(`[INFO] ${message}`);
  }
  return true;
};

/**
 * Resets the error count for a specific message
 * @param {string} message - The message to reset the count for
 */
export const resetErrorCount = (message) => {
  errorCounts.delete(message);
};

/**
 * Resets the warning count for a specific message
 * @param {string} message - The message to reset the count for
 */
export const resetWarningCount = (message) => {
  warningCounts.delete(message);
};

/**
 * Resets all error and warning counts
 */
export const resetAllCounts = () => {
  errorCounts.clear();
  warningCounts.clear();
};

/**
 * Enable or disable all error tracking
 * @param {boolean} enable - Whether to enable error tracking
 */
export const setErrorTrackingEnabled = (enable) => {
  // This requires modifying the module-level variable
  // It's generally not good practice, but in this case it's the simplest solution
  window.PTCG_ERROR_TRACKING_ENABLED = enable;
  
  // Update the module variable by reference
  Object.defineProperty(module.exports, 'ENABLE_ERROR_TRACKING', {
    get: () => window.PTCG_ERROR_TRACKING_ENABLED
  });
};

/**
 * Enable or disable warnings only (errors will still be logged)
 * @param {boolean} enable - Whether to enable warnings
 */
export const setWarningsEnabled = (enable) => {
  // This requires modifying the module-level variable
  window.PTCG_WARNINGS_ENABLED = enable;
  
  // Update the module variable by reference
  Object.defineProperty(module.exports, 'ENABLE_WARNINGS', {
    get: () => window.PTCG_WARNINGS_ENABLED
  });
};

// Set initial values in the window object for persistence
window.PTCG_ERROR_TRACKING_ENABLED = ENABLE_ERROR_TRACKING;
window.PTCG_WARNINGS_ENABLED = ENABLE_WARNINGS;

export default {
  logError,
  logWarning,
  logInfo,
  resetErrorCount,
  resetWarningCount,
  resetAllCounts,
  setErrorTrackingEnabled,
  setWarningsEnabled,
  // Export the config variables too
  get ENABLE_ERROR_TRACKING() { return window.PTCG_ERROR_TRACKING_ENABLED; },
  get ENABLE_WARNINGS() { return window.PTCG_WARNINGS_ENABLED; }
};