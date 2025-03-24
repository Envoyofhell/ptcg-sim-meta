/**
 * Enhanced Logging Module for PTCG-Sim-Meta Client
 * 
 * This module provides comprehensive logging functionality with
 * different log levels, timestamps, and context.
 * 
 * File: client/src/utils/logging.js
 */

// Log levels with numeric values for comparison
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
  };
  
  // Default configuration
  const config = {
    level: 'info',             // Default log level
    enableConsole: true,       // Whether to log to console
    showTimestamp: true,       // Whether to include timestamps
    showContext: true,         // Whether to show context in logs
    colorize: true,            // Whether to colorize console logs
    debug: false               // Debug mode for more verbose logging
  };
  
  // Initialize log history storage
  const logHistory = [];
  const MAX_LOG_HISTORY = 1000;
  
  /**
   * Main logging function
   * 
   * @param {string} message - Message to log
   * @param {string} level - Log level (debug, info, warn, error, fatal)
   * @param {string} context - Optional context for the log
   * @param {Object} data - Optional data to include with the log
   * @returns {Object} Log entry object
   */
  function log(message, level = 'info', context = '', data = undefined) {
    // Only log if the level is sufficient
    if (LOG_LEVELS[level] < LOG_LEVELS[config.level]) {
      return null;
    }
    
    // Create log entry
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      message,
      context: context || '',
      data: data ? (typeof data === 'object' ? { ...data } : data) : undefined
    };
    
    // Add to history, maintaining maximum size
    logHistory.unshift(entry);
    if (logHistory.length > MAX_LOG_HISTORY) {
      logHistory.pop();
    }
    
    // Log to console if enabled
    if (config.enableConsole) {
      logToConsole(entry);
    }
    
    return entry;
  }
  
  /**
   * Log to the console with appropriate formatting
   * 
   * @param {Object} entry - Log entry to display
   */
  function logToConsole(entry) {
    const { timestamp, level, message, context, data } = entry;
    
    // Format the prefix
    let prefix = '';
    
    if (config.showTimestamp) {
      prefix += `[${timestamp}] `;
    }
    
    prefix += `[${level.toUpperCase()}]`;
    
    if (config.showContext && context) {
      prefix += ` [${context}]`;
    }
    
    // Determine console method and styling
    let consoleMethod;
    let style = '';
    
    if (config.colorize) {
      switch (level) {
        case 'debug':
          consoleMethod = console.debug;
          style = 'color: #9E9E9E';
          break;
        case 'info':
          consoleMethod = console.info;
          style = 'color: #2196F3';
          break;
        case 'warn':
          consoleMethod = console.warn;
          style = 'color: #FF9800; font-weight: bold';
          break;
        case 'error':
          consoleMethod = console.error;
          style = 'color: #F44336; font-weight: bold';
          break;
        case 'fatal':
          consoleMethod = console.error;
          style = 'color: #B71C1C; font-weight: bold; text-decoration: underline';
          break;
        default:
          consoleMethod = console.log;
          style = '';
      }
      
      // Log with styling
      consoleMethod(`%c${prefix} ${message}`, style);
    } else {
      // Log without styling
      switch (level) {
        case 'debug':
          consoleMethod = console.debug;
          break;
        case 'info':
          consoleMethod = console.info;
          break;
        case 'warn':
          consoleMethod = console.warn;
          break;
        case 'error':
        case 'fatal':
          consoleMethod = console.error;
          break;
        default:
          consoleMethod = console.log;
      }
      
      consoleMethod(`${prefix} ${message}`);
    }
    
    // Log additional data if present
    if (data !== undefined) {
      consoleMethod(data);
    }
  }
  
  /**
   * Update logger configuration
   * 
   * @param {Object} newConfig - New configuration options
   * @returns {Object} Updated configuration
   */
  function updateConfig(newConfig) {
    Object.assign(config, newConfig);
    return { ...config };
  }
  
  /**
   * Convenience method for debug logs
   * 
   * @param {string} message - Message to log
   * @param {string} context - Optional context
   * @param {Object} data - Optional data
   * @returns {Object} Log entry
   */
  function debug(message, context = '', data = undefined) {
    return log(message, 'debug', context, data);
  }
  
  /**
   * Convenience method for info logs
   * 
   * @param {string} message - Message to log
   * @param {string} context - Optional context
   * @param {Object} data - Optional data
   * @returns {Object} Log entry
   */
  function info(message, context = '', data = undefined) {
    return log(message, 'info', context, data);
  }
  
  /**
   * Convenience method for warning logs
   * 
   * @param {string} message - Message to log
   * @param {string} context - Optional context
   * @param {Object} data - Optional data
   * @returns {Object} Log entry
   */
  function warn(message, context = '', data = undefined) {
    return log(message, 'warn', context, data);
  }
  
  /**
   * Convenience method for error logs
   * 
   * @param {string} message - Message to log
   * @param {string} context - Optional context
   * @param {Object} data - Optional data
   * @returns {Object} Log entry
   */
  function error(message, context = '', data = undefined) {
    return log(message, 'error', context, data);
  }
  
  /**
   * Get all stored logs
   * 
   * @returns {Array} Log history
   */
  function getLogs() {
    return [...logHistory];
  }
  
  /**
   * Get logs filtered by level
   * 
   * @param {string} level - Log level to filter by
   * @returns {Array} Filtered logs
   */
  function getLogsByLevel(level) {
    return logHistory.filter(entry => entry.level === level);
  }
  
  /**
   * Get logs filtered by context
   * 
   * @param {string} context - Context to filter by
   * @returns {Array} Filtered logs
   */
  function getLogsByContext(context) {
    return logHistory.filter(entry => entry.context === context);
  }
  
  /**
   * Clear all logs
   */
  function clearLogs() {
    logHistory.length = 0;
  }
  
  // Create the logger object with all methods
  const logger = {
    log,
    debug,
    info,
    warn,
    error,
    updateConfig,
    getLogs,
    getLogsByLevel,
    getLogsByContext,
    clearLogs
  };
  
  // Export both the default logger and individual functions
  export default logger;
  export { 
    log, 
    debug, 
    info, 
    warn, 
    error, 
    updateConfig, 
    getLogs, 
    getLogsByLevel, 
    getLogsByContext, 
    clearLogs,
    logger
  };