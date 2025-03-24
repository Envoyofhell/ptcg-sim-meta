/**
 * Enhanced Error Handling and Reporting Module for PTCG-Sim-Meta
 *
 * This module provides comprehensive error handling, reporting, and
 * recovery capabilities across the application.
 *
 * Features:
 * - Centralized error handling
 * - Detailed error logging
 * - User-friendly error messages
 * - Automatic error recovery when possible
 * - Telemetry for monitoring and debugging
 */

// Store errors for analysis and reporting
const errorStore = {
  errors: [],
  maxErrors: 100,

  /**
   * Add an error to the store
   * @param {Error} error - The error object
   * @param {string} context - Context where the error occurred
   * @param {boolean} isFatal - Whether the error is fatal
   * @param {Object} additionalData - Any additional relevant data
   */
  addError(error, context = 'unknown', isFatal = false, additionalData = {}) {
    // Create a structured error record
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: error.message || 'Unknown error',
      stack: error.stack,
      type: error.name || error.constructor.name,
      context,
      isFatal,
      url: typeof window !== 'undefined' ? window.location.href : 'N/A',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      additionalData,
    };

    // Add to the beginning of the array
    this.errors.unshift(errorRecord);

    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors.pop();
    }

    return errorRecord;
  },

  /**
   * Get all stored errors
   * @returns {Array} Array of error records
   */
  getErrors() {
    return [...this.errors];
  },

  /**
   * Get errors by context
   * @param {string} context - Context to filter by
   * @returns {Array} Filtered error records
   */
  getErrorsByContext(context) {
    return this.errors.filter((error) => error.context === context);
  },

  /**
   * Clear all stored errors
   */
  clearErrors() {
    this.errors = [];
  },
};

/**
 * Log an error with detailed information
 *
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @param {boolean} isFatal - Whether the error is fatal
 * @param {Object} additionalData - Any additional relevant data
 */
function logError(
  error,
  context = 'unknown',
  isFatal = false,
  additionalData = {}
) {
  // Create structured error record
  const errorRecord = errorStore.addError(
    error,
    context,
    isFatal,
    additionalData
  );

  // Log to console with distinctive formatting
  const timestamp = new Date().toISOString();

  // Use different console methods based on severity
  const logMethod = isFatal ? console.error : console.warn;

  // Format the log message
  logMethod(
    `[${timestamp}] ${isFatal ? 'FATAL ERROR' : 'ERROR'} in ${context}: ${error.message}`
  );

  // Log stack trace if available
  if (error.stack) {
    console.debug(`Stack trace: ${error.stack}`);
  }

  // Log additional data if provided
  if (Object.keys(additionalData).length > 0) {
    console.debug('Additional data:', additionalData);
  }

  // Report error to monitoring service if in production
  if (
    typeof window !== 'undefined' &&
    window.location.hostname.includes('ptcg-sim-meta.pages.dev')
  ) {
    reportErrorToMonitoring(errorRecord);
  }

  return errorRecord;
}

/**
 * Report an error to a monitoring service
 *
 * @param {Object} errorRecord - Structured error record
 */
function reportErrorToMonitoring(errorRecord) {
  // Check if we should actually send this error
  // Don't spam the monitoring service with the same error
  const isSendable = shouldSendToMonitoring(errorRecord);

  if (!isSendable) {
    return;
  }

  // We could integrate with an error monitoring service here
  // For now, just log that we would report it
  console.debug('Would report to monitoring service:', errorRecord);

  // You could implement a real reporting mechanism like:
  /*
    fetch('https://your-monitoring-service.com/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(errorRecord),
    }).catch(err => {
      // Don't throw errors from error reporting
      console.warn('Failed to report error to monitoring service:', err);
    });
    */
}

/**
 * Determine if an error should be sent to monitoring
 *
 * @param {Object} errorRecord - Structured error record
 * @returns {boolean} Whether to send the error
 */
function shouldSendToMonitoring(errorRecord) {
  // Don't report errors for local development
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
  ) {
    return false;
  }

  // Don't report certain known errors
  // For example, network errors when offline
  if (errorRecord.type === 'NetworkError' && navigator && !navigator.onLine) {
    return false;
  }

  // Don't report CORS errors for third-party resources
  if (errorRecord.message.includes('CORS policy')) {
    return false;
  }

  // Only report the same error once per session
  const recentErrors = errorStore.getErrors().slice(0, 10);
  const isDuplicate = recentErrors.some(
    (e) =>
      e.message === errorRecord.message &&
      e.context === errorRecord.context &&
      e !== errorRecord
  );

  if (isDuplicate) {
    return false;
  }

  return true;
}

/**
 * Create a user-friendly error message
 *
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred
 * @returns {string} User-friendly error message
 */
function createUserFriendlyMessage(error, context) {
  // Map common errors to user-friendly messages
  const errorTypeMap = {
    SyntaxError:
      'There was a problem with the code. Please try refreshing the page.',
    ReferenceError:
      'There was a programming error. Please try refreshing the page.',
    TypeError:
      'There was a type mismatch in the code. Please try refreshing the page.',
    NetworkError:
      'There was a network issue. Please check your internet connection and try again.',
    TimeoutError: 'The operation timed out. Please try again.',
    AbortError: 'The operation was cancelled.',
    QuotaExceededError:
      'The storage quota has been exceeded. Please clear some space and try again.',
  };

  // Context-specific messages
  const contextMap = {
    socket:
      'There was an issue with the connection. Please try refreshing the page.',
    database: 'There was an issue accessing your data. Please try again later.',
    api: 'There was an issue connecting to the server. Please try again later.',
    auth: 'There was an authentication issue. Please try logging in again.',
    storage:
      'There was an issue saving your data. Please make sure you have enough storage space.',
    import:
      'There was an issue importing your data. Please check the format and try again.',
    export: 'There was an issue exporting your data. Please try again.',
  };

  // Try to get a message based on error type
  const typeMessage =
    errorTypeMap[error.name] ||
    'An unexpected error occurred. Please try again.';

  // Try to get a message based on context
  const contextMessage = contextMap[context] || '';

  // Use context message if available, otherwise use type message
  return contextMessage || typeMessage;
}

/**
 * Display an error message to the user
 *
 * @param {string} message - The error message to display
 * @param {string} level - Error level ('error', 'warning', 'info')
 * @param {number} duration - Duration in ms to show the message (0 for persistent)
 * @param {Function} onAction - Optional callback for user action
 */
function displayErrorToUser(
  message,
  level = 'error',
  duration = 5000,
  onAction = null
) {
  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    return;
  }

  // Create or get the error container
  let errorContainer = document.getElementById('error-container');

  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'error-container';
    errorContainer.style.position = 'fixed';
    errorContainer.style.bottom = '20px';
    errorContainer.style.right = '20px';
    errorContainer.style.zIndex = '9999';
    document.body.appendChild(errorContainer);
  }

  // Create the error message element
  const errorElement = document.createElement('div');
  errorElement.style.backgroundColor =
    level === 'error' ? '#f44336' : level === 'warning' ? '#ff9800' : '#2196f3';
  errorElement.style.color = 'white';
  errorElement.style.padding = '15px 20px';
  errorElement.style.marginTop = '10px';
  errorElement.style.borderRadius = '4px';
  errorElement.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
  errorElement.style.display = 'flex';
  errorElement.style.justifyContent = 'space-between';
  errorElement.style.alignItems = 'center';
  errorElement.style.maxWidth = '400px';
  errorElement.style.wordBreak = 'break-word';

  // Add the message
  const messageElement = document.createElement('div');
  messageElement.textContent = message;
  errorElement.appendChild(messageElement);

  // Add a close button
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.style.backgroundColor = 'transparent';
  closeButton.style.border = 'none';
  closeButton.style.color = 'white';
  closeButton.style.fontSize = '20px';
  closeButton.style.marginLeft = '10px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.padding = '0 5px';
  closeButton.onclick = () => {
    errorElement.remove();
  };
  errorElement.appendChild(closeButton);

  // Add an action button if callback provided
  if (onAction) {
    const actionButton = document.createElement('button');
    actionButton.textContent = 'Retry';
    actionButton.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    actionButton.style.border = 'none';
    actionButton.style.color = 'white';
    actionButton.style.padding = '5px 10px';
    actionButton.style.borderRadius = '4px';
    actionButton.style.marginLeft = '10px';
    actionButton.style.cursor = 'pointer';
    actionButton.onclick = () => {
      onAction();
      errorElement.remove();
    };
    errorElement.appendChild(actionButton);
  }

  // Add to the container
  errorContainer.appendChild(errorElement);

  // Auto-remove after duration (if not persistent)
  if (duration > 0) {
    setTimeout(() => {
      if (errorElement.parentNode) {
        errorElement.remove();
      }
    }, duration);
  }
}

/**
 * Global error handler for uncaught exceptions
 *
 * @param {ErrorEvent} event - Error event object
 */
function globalErrorHandler(event) {
  // Prevent default browser error handling
  event.preventDefault();

  // Extract error details
  const error = event.error || new Error(event.message || 'Unknown error');
  const fileName = event.filename || 'unknown';
  const lineNumber = event.lineno || 'unknown';
  const columnNumber = event.colno || 'unknown';

  // Determine context from file name
  const filePathParts = fileName.split('/');
  const file = filePathParts[filePathParts.length - 1];
  let context = 'unknown';

  if (file.includes('socket')) {
    context = 'socket';
  } else if (file.includes('db') || file.includes('database')) {
    context = 'database';
  } else if (file.includes('api')) {
    context = 'api';
  } else if (file.includes('auth')) {
    context = 'auth';
  } else if (file.includes('storage')) {
    context = 'storage';
  } else if (file.includes('import')) {
    context = 'import';
  } else if (file.includes('export')) {
    context = 'export';
  }

  // Add location data
  const additionalData = {
    fileName,
    lineNumber,
    columnNumber,
    url: window.location.href,
  };

  // Log the error
  logError(error, context, false, additionalData);

  // Create a user-friendly message
  const userMessage = createUserFriendlyMessage(error, context);

  // Display to user
  displayErrorToUser(userMessage, 'error', 10000);

  // Return true to prevent the error from being displayed in the console again
  return true;
}

/**
 * Global handler for unhandled promise rejections
 *
 * @param {PromiseRejectionEvent} event - Promise rejection event
 */
function unhandledRejectionHandler(event) {
  // Prevent default browser handling
  event.preventDefault();

  // Extract error details
  const error =
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason) || 'Unhandled Promise rejection');

  // Determine context
  let context = 'async';

  // Add location data
  const additionalData = {
    url: window.location.href,
    promiseRejection: true,
  };

  // Log the error
  logError(error, context, false, additionalData);

  // Create a user-friendly message
  const userMessage = createUserFriendlyMessage(error, context);

  // Display to user
  displayErrorToUser(userMessage, 'warning', 8000);

  // Return true to prevent the error from being displayed in the console again
  return true;
}

/**
 * Setup global error handlers
 */
function setupGlobalErrorHandlers() {
  if (typeof window !== 'undefined') {
    // Handle uncaught exceptions
    window.addEventListener('error', globalErrorHandler);

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);

    console.log('Global error handlers installed');
  }
}

/**
 * Create a try-catch wrapper for any function
 *
 * @param {Function} fn - The function to wrap
 * @param {string} context - Context for error reporting
 * @param {boolean} isFatal - Whether errors are fatal
 * @param {Function} onError - Optional error handler
 * @returns {Function} Wrapped function
 */
function withErrorHandling(
  fn,
  context = 'unknown',
  isFatal = false,
  onError = null
) {
  return function (...args) {
    try {
      return fn.apply(this, args);
    } catch (error) {
      // Log the error
      logError(error, context, isFatal);

      // Call custom error handler if provided
      if (onError) {
        return onError(error);
      }

      // Re-throw fatal errors
      if (isFatal) {
        throw error;
      }

      // Return undefined for non-fatal errors
      return undefined;
    }
  };
}

/**
 * Create a try-catch wrapper for async functions
 *
 * @param {Function} fn - The async function to wrap
 * @param {string} context - Context for error reporting
 * @param {boolean} isFatal - Whether errors are fatal
 * @param {Function} onError - Optional error handler
 * @returns {Function} Wrapped async function
 */
function withAsyncErrorHandling(
  fn,
  context = 'unknown',
  isFatal = false,
  onError = null
) {
  return async function (...args) {
    try {
      return await fn.apply(this, args);
    } catch (error) {
      // Log the error
      logError(error, context, isFatal);

      // Call custom error handler if provided
      if (onError) {
        return onError(error);
      }

      // Re-throw fatal errors
      if (isFatal) {
        throw error;
      }

      // Return undefined for non-fatal errors
      return undefined;
    }
  };
}

/**
 * Initialize the error handling module
 */
function initErrorHandling() {
  // Setup global error handlers
  setupGlobalErrorHandlers();

  // Log initialization
  console.log('Error handling module initialized');

  // Return the public API
  return {
    logError,
    displayErrorToUser,
    withErrorHandling,
    withAsyncErrorHandling,
    getErrors: errorStore.getErrors.bind(errorStore),
    clearErrors: errorStore.clearErrors.bind(errorStore),
  };
}

// Export the module
export const ErrorHandling = initErrorHandling();
export default ErrorHandling;
