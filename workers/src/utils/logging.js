/**
 * Enhanced Logging Module for PTCG-Sim-Meta
 *
 * This module provides comprehensive logging functionality with
 * different log levels, formatting options, and output destinations.
 *
 * Features:
 * - Multiple log levels (debug, info, warn, error, fatal)
 * - Contextual logging
 * - Log formatting
 * - Log rotation and management
 * - Environment-specific logging
 */

// Configuration
const DEFAULT_CONFIG = {
  level: 'info', // Default log level
  maxLogs: 1000, // Maximum number of logs to keep in memory
  enableConsole: true, // Whether to log to console
  timestampFormat: 'ISO', // Format of timestamps in logs
  showContext: true, // Whether to show context in logs
  colorize: true, // Whether to colorize console logs
  debug: false, // Debug mode for more verbose logging
};

// Log levels with numeric values for comparison
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// Store for logs
const logStore = {
  logs: [],
  config: { ...DEFAULT_CONFIG },

  /**
   * Add a log entry to the store
   * @param {Object} logEntry - Log entry to add
   */
  addLog(logEntry) {
    this.logs.unshift(logEntry);

    // Keep only the maximum number of logs
    if (this.logs.length > this.config.maxLogs) {
      this.logs.pop();
    }
  },

  /**
   * Get all stored logs
   * @returns {Array} Stored logs
   */
  getLogs() {
    return [...this.logs];
  },

  /**
   * Get logs by level
   * @param {string} level - Log level to filter by
   * @returns {Array} Filtered logs
   */
  getLogsByLevel(level) {
    return this.logs.filter((log) => log.level === level);
  },

  /**
   * Get logs by context
   * @param {string} context - Context to filter by
   * @returns {Array} Filtered logs
   */
  getLogsByContext(context) {
    return this.logs.filter((log) => log.context === context);
  },

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  },

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration settings
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  },
};

/**
 * Format a timestamp according to the specified format
 *
 * @param {Date} date - Date to format
 * @param {string} format - Format to use ('ISO', 'short', 'time', 'epoch')
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(date, format) {
  switch (format) {
    case 'ISO':
      return date.toISOString();
    case 'short':
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    case 'time':
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    case 'epoch':
      return date.getTime().toString();
    default:
      return date.toISOString();
  }
}

/**
 * Get console style for a log level when colorization is enabled
 *
 * @param {string} level - Log level
 * @returns {Object} Style object with format strings
 */
function getConsoleStyle(level) {
  switch (level) {
    case 'debug':
      return {
        prefix: '%c[DEBUG]',
        style: 'color: #9E9E9E;',
        prefixColor: '#9E9E9E',
      };
    case 'info':
      return {
        prefix: '%c[INFO]',
        style: 'color: #2196F3;',
        prefixColor: '#2196F3',
      };
    case 'warn':
      return {
        prefix: '%c[WARNING]',
        style: 'color: #FF9800; font-weight: bold;',
        prefixColor: '#FF9800',
      };
    case 'error':
      return {
        prefix: '%c[ERROR]',
        style: 'color: #F44336; font-weight: bold;',
        prefixColor: '#F44336',
      };
    case 'fatal':
      return {
        prefix: '%c[FATAL]',
        style: 'color: #B71C1C; font-weight: bold; text-decoration: underline;',
        prefixColor: '#B71C1C',
      };
    default:
      return {
        prefix: '%c[LOG]',
        style: 'color: inherit;',
        prefixColor: 'inherit',
      };
  }
}

/**
 * Format a log message for display
 *
 * @param {Object} logEntry - Log entry to format
 * @param {Object} config - Logger configuration
 * @returns {Array} Formatted log parts
 */
function formatLogMessage(logEntry, config) {
  const { timestamp, level, message, context, data } = logEntry;
  const { timestampFormat, showContext, colorize } = config;

  // Format timestamp
  const formattedTimestamp = formatTimestamp(
    new Date(timestamp),
    timestampFormat
  );

  // Get console style if colorization is enabled
  const style = colorize ? getConsoleStyle(level) : null;

  // Format message parts
  const parts = [];

  if (colorize) {
    // With colorization
    parts.push(`[${formattedTimestamp}] ${style.prefix}`);
    parts.push(style.style);

    let messagePart = '';

    if (showContext && context) {
      messagePart += `[${context}] `;
    }

    messagePart += message;
    parts.push(messagePart);

    // Add data if present
    if (data !== undefined && Object.keys(data).length > 0) {
      parts.push(data);
    }
  } else {
    // Without colorization
    let messagePart = `[${formattedTimestamp}] [${level.toUpperCase()}]`;

    if (showContext && context) {
      messagePart += ` [${context}]`;
    }

    messagePart += ` ${message}`;
    parts.push(messagePart);

    // Add data if present
    if (data !== undefined && Object.keys(data).length > 0) {
      parts.push(data);
    }
  }

  return parts;
}

/**
 * Log to console with appropriate level
 *
 * @param {Object} logEntry - Log entry to log
 * @param {Object} config - Logger configuration
 */
function logToConsole(logEntry, config) {
  if (!config.enableConsole) {
    return;
  }

  const { level } = logEntry;
  const parts = formatLogMessage(logEntry, config);

  // Use the appropriate console method
  switch (level) {
    case 'debug':
      console.debug(...parts);
      break;
    case 'info':
      console.info(...parts);
      break;
    case 'warn':
      console.warn(...parts);
      break;
    case 'error':
    case 'fatal':
      console.error(...parts);
      break;
    default:
      console.log(...parts);
  }
}

/**
 * Determine if a message should be logged based on level
 *
 * @param {string} messageLevel - Level of the message
 * @param {string} configLevel - Configured minimum level
 * @returns {boolean} Whether to log the message
 */
function shouldLog(messageLevel, configLevel) {
  return LOG_LEVELS[messageLevel] >= LOG_LEVELS[configLevel];
}

/**
 * Create a logger object
 *
 * @param {Object} customConfig - Custom configuration
 * @returns {Object} Logger object
 */
function createLogger(customConfig = {}) {
  // Merge custom configuration with defaults
  const config = { ...DEFAULT_CONFIG, ...customConfig };

  // Update store configuration
  logStore.updateConfig(config);

  // Create logger methods for each level
  const logger = {};

  // Add logging methods for each level
  Object.keys(LOG_LEVELS).forEach((level) => {
    logger[level] = (message, context = '', data = undefined) => {
      // Check if this message should be logged
      if (!shouldLog(level, config.level)) {
        return;
      }

      // Create log entry
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
        data,
      };

      // Add to store
      logStore.addLog(logEntry);

      // Log to console
      logToConsole(logEntry, config);

      return logEntry;
    };
  });

  // Add convenience method for logging with any level
  logger.log = (message, level = 'info', context = '', data = undefined) => {
    // Use the appropriate level method
    if (logger[level]) {
      return logger[level](message, context, data);
    } else {
      // Default to info if level is invalid
      return logger.info(message, context, data);
    }
  };

  // Add method to get logs
  logger.getLogs = () => logStore.getLogs();

  // Add method to get logs by level
  logger.getLogsByLevel = (level) => logStore.getLogsByLevel(level);

  // Add method to get logs by context
  logger.getLogsByContext = (context) => logStore.getLogsByContext(context);

  // Add method to clear logs
  logger.clearLogs = () => logStore.clearLogs();

  // Add method to update configuration
  logger.updateConfig = (newConfig) => {
    const updatedConfig = { ...config, ...newConfig };
    logStore.updateConfig(updatedConfig);
    Object.assign(config, updatedConfig);
    return updatedConfig;
  };

  // Add method to get current configuration
  logger.getConfig = () => ({ ...config });

  // Log initialization
  if (config.debug) {
    logger.debug('Logger initialized', 'logger', config);
  }

  return logger;
}

// Create default logger
const defaultLogger = createLogger();

// Export both the default logger and the factory function
export const logger = defaultLogger;
export default defaultLogger;
export { createLogger };
