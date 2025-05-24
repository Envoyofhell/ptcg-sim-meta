// ===================================================================
// File: client/shared/raid/RaidErrorHandler.js
// Path: /client/shared/raid/RaidErrorHandler.js
// Purpose: Error handling and logging utilities for raid system
// Version: 1.0.0
//
// Dependencies:
//   - None (standalone utility)
//
// Used By:
//   - ../src/raid/RaidClientCore.js
//   - Other client-side raid components
//
// Changelog:
//   v1.0.0 - Initial implementation
// ===================================================================

export const raidErrorHandler = {
  // Error code definitions
  codes: {
    SYSTEM: 'SYSTEM_ERROR',
    CONNECTION_LOST: 'CONNECTION_LOST',
    RAID_NOT_FOUND: 'RAID_NOT_FOUND',
    INVALID_ACTION: 'INVALID_ACTION',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    TIMEOUT: 'TIMEOUT',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
  },

  // Error log storage
  errorLog: [],
  maxLogSize: 50,

  // Log an error with context
  logError(errorCode, message, context = {}) {
    const errorEntry = {
      code: errorCode,
      message: message,
      context: context,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Add to error log
    this.errorLog.unshift(errorEntry);

    // Maintain max log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }

    // Console output based on error severity
    const consoleMessage = `[RaidError:${errorCode}] ${message}`;

    if (this.isCriticalError(errorCode)) {
      console.error(consoleMessage, context);
    } else {
      console.warn(consoleMessage, context);
    }

    // Trigger custom error event
    this.dispatchErrorEvent(errorEntry);

    return errorEntry;
  },

  // Check if error code represents a critical error
  isCriticalError(errorCode) {
    const criticalErrors = [this.codes.SYSTEM, this.codes.CONNECTION_LOST];
    return criticalErrors.includes(errorCode);
  },

  // Dispatch custom error event for other components to listen to
  dispatchErrorEvent(errorEntry) {
    const event = new CustomEvent('raidError', {
      detail: errorEntry,
    });
    document.dispatchEvent(event);
  },

  // Get recent errors
  getRecentErrors(limit = 10) {
    return this.errorLog.slice(0, limit);
  },

  // Get errors by code
  getErrorsByCode(errorCode) {
    return this.errorLog.filter((error) => error.code === errorCode);
  },

  // Clear error log
  clearErrors() {
    this.errorLog = [];
  },

  // Get error statistics
  getErrorStats() {
    const stats = {};

    this.errorLog.forEach((error) => {
      if (!stats[error.code]) {
        stats[error.code] = {
          count: 0,
          lastOccurred: 0,
          firstOccurred: Date.now(),
        };
      }

      stats[error.code].count++;
      stats[error.code].lastOccurred = Math.max(
        stats[error.code].lastOccurred,
        error.timestamp
      );
      stats[error.code].firstOccurred = Math.min(
        stats[error.code].firstOccurred,
        error.timestamp
      );
    });

    return stats;
  },

  // Format error for display
  formatError(errorEntry) {
    const date = new Date(errorEntry.timestamp);
    return {
      time: date.toLocaleTimeString(),
      code: errorEntry.code,
      message: errorEntry.message,
      context: errorEntry.context,
    };
  },

  // Handle network errors specifically
  handleNetworkError(error, operation = 'unknown') {
    let errorCode = this.codes.CONNECTION_LOST;
    let message = `Network error during ${operation}`;

    if (error.name === 'TimeoutError') {
      errorCode = this.codes.TIMEOUT;
      message = `Request timeout during ${operation}`;
    }

    return this.logError(errorCode, message, {
      originalError: error.message,
      operation: operation,
      stack: error.stack,
    });
  },

  // Handle validation errors
  handleValidationError(fieldName, value, expectedType) {
    return this.logError(
      this.codes.VALIDATION_ERROR,
      `Validation failed for ${fieldName}`,
      {
        field: fieldName,
        value: value,
        expectedType: expectedType,
      }
    );
  },

  // Create user-friendly error messages
  getUserFriendlyMessage(errorCode) {
    const messages = {
      [this.codes.SYSTEM]: 'A system error occurred. Please try again.',
      [this.codes.CONNECTION_LOST]:
        'Connection lost. Attempting to reconnect...',
      [this.codes.RAID_NOT_FOUND]: 'Raid not found. Please check the Raid ID.',
      [this.codes.INVALID_ACTION]: 'That action is not valid right now.',
      [this.codes.PERMISSION_DENIED]: "You don't have permission to do that.",
      [this.codes.TIMEOUT]: 'Request timed out. Please try again.',
      [this.codes.VALIDATION_ERROR]: 'Invalid input. Please check your data.',
    };

    return messages[errorCode] || 'An unknown error occurred.';
  },

  // Export error log for debugging
  exportErrorLog() {
    return {
      errors: this.errorLog,
      stats: this.getErrorStats(),
      exportTime: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
  },
};
