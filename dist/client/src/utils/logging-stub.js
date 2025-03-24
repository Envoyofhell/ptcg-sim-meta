/**
 * Stub logging module for PTCG-Sim-Meta
 * This file is loaded when the real logging module can't be found
 *
 * File: client/workers/src/utils/logging-stub.js
 */

// Create a simple logger that forwards to console
export const log = function (message, level = 'info', context = '') {
  const timestamp = new Date().toISOString();
  const prefix = level.toUpperCase();

  // Format the message
  const formattedMessage = `[${timestamp}] [${prefix}]${context ? ` [${context}]` : ''} ${message}`;

  // Use appropriate console method
  switch (level) {
    case 'error':
      console.error(formattedMessage);
      break;
    case 'warn':
      console.warn(formattedMessage);
      break;
    case 'debug':
      console.debug(formattedMessage);
      break;
    case 'info':
    default:
      console.info(formattedMessage);
  }

  return { timestamp, level, message, context };
};

// For compatibility with both named and default exports
export default log;

// Legacy API compatibility
export const logger = {
  debug: (message, context = '') => log(message, 'debug', context),
  info: (message, context = '') => log(message, 'info', context),
  warn: (message, context = '') => log(message, 'warn', context),
  error: (message, context = '') => log(message, 'error', context),
  log: (message, level = 'info', context = '') => log(message, level, context),
};
