// New client/src/services/log-service.js
class LogService {
    constructor() {
      this.debugMode = false;
      this.logHistory = [];
      this.maxLogHistory = 1000;
      this.consoleEnabled = true;
      
      // Initialize with window error handler
      this.setupGlobalErrorHandlers();
    }
    
    /**
     * Enable or disable debug mode
     * @param {boolean} enabled - Whether debug mode is enabled
     */
    setDebugMode(enabled) {
      this.debugMode = !!enabled;
      console.log(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Log a message with severity level
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, warn, error, debug, success)
     * @param {Object} data - Optional data to include with log
     */
    log(message, level = 'info', data = null) {
      // Skip debug messages when not in debug mode
      if (level === 'debug' && !this.debugMode) {
        return;
      }
      
      const timestamp = new Date().toISOString();
      const entry = {
        timestamp,
        level,
        message,
        data: data ? JSON.stringify(data) : undefined
      };
      
      // Add to history, removing oldest if at capacity
      this.logHistory.push(entry);
      if (this.logHistory.length > this.maxLogHistory) {
        this.logHistory.shift();
      }
      
      // Format for console
      let consoleMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      if (data) {
        consoleMessage += ` | ${typeof data === 'object' ? JSON.stringify(data) : data}`;
      }
      
      // Output to console if enabled
      if (this.consoleEnabled) {
        switch (level) {
          case 'error':
            console.error(consoleMessage);
            break;
          case 'warn':
            console.warn(consoleMessage);
            break;
          case 'debug':
            console.debug(consoleMessage);
            break;
          case 'success':
            console.log(`%c${consoleMessage}`, 'color: green; font-weight: bold');
            break;
          default:
            console.log(consoleMessage);
        }
      }
      
      // Show critical errors on screen
      if (level === 'error') {
        this.showErrorNotification(message);
      }
      
      return entry;
    }
    
    /**
     * Log an error with stack trace
     * @param {Error} error - Error object
     * @param {string} context - Error context
     */
    logError(error, context = '') {
      const contextMessage = context ? ` [${context}]` : '';
      this.log(`${error.message}${contextMessage}`, 'error');
      
      if (this.debugMode && error.stack) {
        this.log(`Stack trace: ${error.stack}`, 'debug');
      }
    }
    
    /**
     * Show an error notification on screen
     * @param {string} message - Error message
     */
    showErrorNotification(message) {
      // Only run in browser environment
      if (typeof window === 'undefined') return;
      
      try {
        // Create or update notification element
        let notification = document.getElementById('error-notification');
        
        if (!notification) {
          notification = document.createElement('div');
          notification.id = 'error-notification';
          notification.style.position = 'fixed';
          notification.style.bottom = '10px';
          notification.style.left = '10px';
          notification.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
          notification.style.color = 'white';
          notification.style.padding = '10px 15px';
          notification.style.borderRadius = '5px';
          notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
          notification.style.zIndex = '9999';
          notification.style.maxWidth = '80%';
          notification.style.wordBreak = 'break-word';
          
          document.body.appendChild(notification);
        }
        
        notification.textContent = `Error: ${message}`;
        notification.style.display = 'block';
        
        // Add close button
        const closeButton = document.createElement('span');
        closeButton.textContent = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '10px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontSize = '18px';
        closeButton.onclick = () => { notification.style.display = 'none'; };
        
        notification.appendChild(closeButton);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
          notification.style.display = 'none';
        }, 10000);
      } catch (e) {
        // Fail silently if we can't show UI notification
        console.error('Could not show error notification:', e);
      }
    }
    
    /**
     * Set up global error handlers
     */
    setupGlobalErrorHandlers() {
      // Only run in browser environment
      if (typeof window === 'undefined') return;
      
      // Handle uncaught exceptions
      window.addEventListener('error', (event) => {
        this.log(`Uncaught error: ${event.message}`, 'error', {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });
      
      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.log(`Unhandled promise rejection: ${event.reason}`, 'error');
      });
    }
    
    /**
     * Get log history
     * @param {string} level - Optional level filter
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Log entries
     */
    getHistory(level = null, limit = 100) {
      let filtered = this.logHistory;
      
      if (level) {
        filtered = filtered.filter(entry => entry.level === level);
      }
      
      return filtered.slice(-limit);
    }
    
    /**
     * Clear log history
     */
    clearHistory() {
      this.logHistory = [];
      this.log('Log history cleared', 'info');
    }
    
    /**
     * Export logs to file
     */
    exportLogs() {
      try {
        const data = JSON.stringify(this.logHistory, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ptcg-logs-${new Date().toISOString()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to export logs:', error);
      }
    }
  }
  
  export { LogService };