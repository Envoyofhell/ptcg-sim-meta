/**
 * Logging utilities
 * 
 * This module provides consistent logging functions with different
 * severity levels and optional debug mode toggling.
 */

// Whether debug logging is enabled
let debugMode = false;

/**
 * Enable or disable debug logging
 * 
 * @param {boolean} enabled - Whether debug logging should be enabled
 */
export function setDebugMode(enabled) {
  debugMode = enabled;
}

/**
 * Log a message with a specified severity level
 * 
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, warn, error, debug, success)
 */
export function log(message, level = 'info') {
  // Get current timestamp
  const timestamp = new Date().toISOString();
  
  // Skip debug messages when debug mode is disabled
  if (level === 'debug' && !debugMode) {
    return;
  }
  
  // Format message based on level
  let formattedMessage;
  
  switch (level) {
    case 'error':
      formattedMessage = `[${timestamp}] ERROR: ${message}`;
      console.error(formattedMessage);
      break;
    case 'warn':
      formattedMessage = `[${timestamp}] WARNING: ${message}`;
      console.warn(formattedMessage);
      break;
    case 'debug':
      formattedMessage = `[${timestamp}] DEBUG: ${message}`;
      console.debug(formattedMessage);
      break;
    case 'success':
      formattedMessage = `[${timestamp}] SUCCESS: ${message}`;
      console.log(formattedMessage);
      break;
    default:
      formattedMessage = `[${timestamp}] INFO: ${message}`;
      console.log(formattedMessage);
  }
}

/**
 * Log an error with stack trace
 * 
 * @param {Error} error - Error object to log
 * @param {string} context - Optional context description
 */
export function logError(error, context = '') {
  const contextMsg = context ? ` [${context}]` : '';
  log(`${error.message}${contextMsg}`, 'error');
  
  if (debugMode && error.stack) {
    log(`Stack trace: ${error.stack}`, 'debug');
  }
}

/**
 * Log a request
 * 
 * @param {Request} request - HTTP request to log
 */
export function logRequest(request) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  const query = url.search;
  
  log(`${method} ${path}${query}`, 'info');
  
  if (debugMode) {
    // Log headers in debug mode
    const headers = {};
    for (const [key, value] of request.headers.entries()) {
      headers[key] = value;
    }
    log(`Headers: ${JSON.stringify(headers)}`, 'debug');
  }
}

/**
 * Log a response
 * 
 * @param {Response} response - HTTP response to log
 */
export function logResponse(response) {
  log(`Response: ${response.status} ${response.statusText}`, 'info');
  
  if (debugMode) {
    // Log headers in debug mode
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
      headers[key] = value;
    }
    log(`Headers: ${JSON.stringify(headers)}`, 'debug');
  }
}