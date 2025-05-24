// ===================================================================
// File: shared/raid/RaidErrorHandler.js
// Path: /shared/raid/RaidErrorHandler.js
// Purpose: Centralized error handling and reporting for raid system
// Version: 2.0.0
// 
// Dependencies:
//   - None (core module)
// 
// Used By:
//   - All raid modules (client and server)
// 
// Changelog:
//   v2.0.0 - Initial implementation with comprehensive error tracking
// ===================================================================

export class RaidErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrorHistory = 100;
        this.errorCallbacks = new Map();
        
        // Error categories
        this.categories = {
            CONNECTION: 'connection',
            SESSION: 'session',
            VALIDATION: 'validation',
            PERMISSION: 'permission',
            GAME_STATE: 'gameState',
            NETWORK: 'network',
            SYSTEM: 'system'
        };
        
        // Error severity levels
        this.severity = {
            DEBUG: 0,
            INFO: 1,
            WARNING: 2,
            ERROR: 3,
            CRITICAL: 4
        };
        
        // Error codes
        this.codes = {
            // Connection errors (1000-1999)
            CONNECTION_LOST: 1001,
            CONNECTION_TIMEOUT: 1002,
            RECONNECTION_FAILED: 1003,
            
            // Session errors (2000-2999)
            SESSION_NOT_FOUND: 2001,
            SESSION_FULL: 2002,
            SESSION_EXPIRED: 2003,
            SESSION_INVALID_ID: 2004,
            SESSION_PASSWORD_REQUIRED: 2005,
            SESSION_INVALID_PASSWORD: 2006,
            
            // Validation errors (3000-3999)
            INVALID_ACTION: 3001,
            INVALID_PARAMETERS: 3002,
            MISSING_REQUIRED_FIELD: 3003,
            
            // Permission errors (4000-4999)
            NOT_YOUR_TURN: 4001,
            INSUFFICIENT_PERMISSIONS: 4002,
            SPECTATOR_ACTION_DENIED: 4003,
            
            // Game state errors (5000-5999)
            GAME_NOT_ACTIVE: 5001,
            INVALID_GAME_STATE: 5002,
            ACTION_NOT_AVAILABLE: 5003,
            
            // Network errors (6000-6999)
            REQUEST_TIMEOUT: 6001,
            SERVER_ERROR: 6002,
            RATE_LIMITED: 6003
        };
        
        this.setupGlobalHandlers();
    }
    
    // ================ ERROR CREATION ================
    
    /**
     * Creates a standardized error object
     */
    createError(code, message, details = {}) {
        const error = {
            id: this.generateErrorId(),
            code: code,
            message: message,
            details: details,
            category: this.getCategoryFromCode(code),
            severity: details.severity || this.getSeverityFromCode(code),
            timestamp: Date.now(),
            stack: new Error().stack,
            handled: false,
            context: this.captureContext()
        };
        
        this.addToHistory(error);
        this.notifyListeners(error);
        
        return error;
    }
    
    /**
     * Creates and logs an error
     */
    logError(code, message, details = {}) {
        const error = this.createError(code, message, details);
        
        // Console output based on severity
        switch (error.severity) {
            case this.severity.DEBUG:
                console.debug(`[RaidError] ${error.message}`, error);
                break;
            case this.severity.INFO:
                console.info(`[RaidError] ${error.message}`, error);
                break;
            case this.severity.WARNING:
                console.warn(`[RaidError] ${error.message}`, error);
                break;
            case this.severity.ERROR:
                console.error(`[RaidError] ${error.message}`, error);
                break;
            case this.severity.CRITICAL:
                console.error(`[RaidError] CRITICAL: ${error.message}`, error);
                break;
        }
        
        return error;
    }
    
    /**
     * Wraps a function with error handling
     */
    wrapAsync(fn, context = 'unknown') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleCaughtError(error, context);
                throw error;
            }
        };
    }
    
    /**
     * Wraps a promise with error handling
     */
    wrapPromise(promise, context = 'unknown') {
        return promise.catch(error => {
            this.handleCaughtError(error, context);
            throw error;
        });
    }
    
    // ================ ERROR HANDLING ================
    
    /**
     * Handles a caught error
     */
    handleCaughtError(error, context) {
        const raidError = this.createError(
            this.codes.SYSTEM,
            error.message || 'Unknown error',
            {
                originalError: error,
                context: context,
                severity: this.severity.ERROR
            }
        );
        
        return raidError;
    }
    
    /**
     * Handles connection errors specifically
     */
    handleConnectionError(error, socketId) {
        return this.createError(
            this.codes.CONNECTION_LOST,
            'Connection lost to server',
            {
                socketId: socketId,
                error: error,
                severity: this.severity.WARNING
            }
        );
    }
    
    /**
     * Handles session errors
     */
    handleSessionError(code, sessionId, details = {}) {
        const messages = {
            [this.codes.SESSION_NOT_FOUND]: `Session ${sessionId} not found`,
            [this.codes.SESSION_FULL]: `Session ${sessionId} is full`,
            [this.codes.SESSION_EXPIRED]: `Session ${sessionId} has expired`,
            [this.codes.SESSION_INVALID_ID]: `Invalid session ID: ${sessionId}`,
            [this.codes.SESSION_PASSWORD_REQUIRED]: `Password required for session ${sessionId}`,
            [this.codes.SESSION_INVALID_PASSWORD]: `Invalid password for session ${sessionId}`
        };
        
        return this.createError(
            code,
            messages[code] || `Session error: ${sessionId}`,
            {
                sessionId: sessionId,
                ...details
            }
        );
    }
    
    /**
     * Handles validation errors
     */
    handleValidationError(field, value, expectedType) {
        return this.createError(
            this.codes.INVALID_PARAMETERS,
            `Invalid ${field}: expected ${expectedType}, got ${typeof value}`,
            {
                field: field,
                value: value,
                expectedType: expectedType,
                severity: this.severity.WARNING
            }
        );
    }
    
    // ================ ERROR RECOVERY ================
    
    /**
     * Attempts to recover from an error
     */
    async attemptRecovery(error) {
        switch (error.code) {
            case this.codes.CONNECTION_LOST:
                return this.attemptReconnection(error);
                
            case this.codes.SESSION_EXPIRED:
                return this.attemptSessionRefresh(error);
                
            case this.codes.RATE_LIMITED:
                return this.handleRateLimit(error);
                
            default:
                return { recovered: false, error: error };
        }
    }
    
    /**
     * Attempts to reconnect after connection loss
     */
    async attemptReconnection(error) {
        const maxAttempts = 3;
        const baseDelay = 1000;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await this.delay(baseDelay * attempt);
            
            try {
                // Attempt reconnection (implement based on your socket system)
                const result = await this.reconnect(error.details.socketId);
                
                if (result.success) {
                    this.logError(
                        this.codes.CONNECTION_LOST,
                        `Reconnected after ${attempt} attempts`,
                        { severity: this.severity.INFO }
                    );
                    return { recovered: true, attempts: attempt };
                }
            } catch (reconnectError) {
                if (attempt === maxAttempts) {
                    this.logError(
                        this.codes.RECONNECTION_FAILED,
                        'Failed to reconnect after maximum attempts',
                        { attempts: maxAttempts, severity: this.severity.ERROR }
                    );
                }
            }
        }
        
        return { recovered: false, error: error };
    }
    
    // ================ ERROR LISTENERS ================
    
    /**
     * Registers an error listener
     */
    onError(category, callback) {
        if (!this.errorCallbacks.has(category)) {
            this.errorCallbacks.set(category, []);
        }
        
        this.errorCallbacks.get(category).push(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.errorCallbacks.get(category);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }
    
    /**
     * Notifies error listeners
     */
    notifyListeners(error) {
        // Notify category-specific listeners
        const categoryListeners = this.errorCallbacks.get(error.category) || [];
        categoryListeners.forEach(callback => {
            try {
                callback(error);
            } catch (e) {
                console.error('Error in error listener:', e);
            }
        });
        
        // Notify global listeners
        const globalListeners = this.errorCallbacks.get('*') || [];
        globalListeners.forEach(callback => {
            try {
                callback(error);
            } catch (e) {
                console.error('Error in global error listener:', e);
            }
        });
    }
    
    // ================ UTILITIES ================
    
    /**
     * Generates unique error ID
     */
    generateErrorId() {
        return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Gets category from error code
     */
    getCategoryFromCode(code) {
        if (code >= 1000 && code < 2000) return this.categories.CONNECTION;
        if (code >= 2000 && code < 3000) return this.categories.SESSION;
        if (code >= 3000 && code < 4000) return this.categories.VALIDATION;
        if (code >= 4000 && code < 5000) return this.categories.PERMISSION;
        if (code >= 5000 && code < 6000) return this.categories.GAME_STATE;
        if (code >= 6000 && code < 7000) return this.categories.NETWORK;
        return this.categories.SYSTEM;
    }
    
    /**
     * Gets severity from error code
     */
    getSeverityFromCode(code) {
        // Critical errors
        if ([this.codes.RECONNECTION_FAILED, this.codes.SESSION_EXPIRED].includes(code)) {
            return this.severity.CRITICAL;
        }
        
        // Errors
        if (code >= 3000) {
            return this.severity.ERROR;
        }
        
        // Warnings
        if (code >= 2000) {
            return this.severity.WARNING;
        }
        
        return this.severity.INFO;
    }
    
    /**
     * Captures current context
     */
    captureContext() {
        const context = {
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.href : 'server'
        };
        
        // Add custom context if available
        if (typeof window !== 'undefined' && window.raidContext) {
            Object.assign(context, window.raidContext);
        }
        
        return context;
    }
    
    /**
     * Adds error to history
     */
    addToHistory(error) {
        this.errors.push(error);
        
        // Trim history
        if (this.errors.length > this.maxErrorHistory) {
            this.errors = this.errors.slice(-this.maxErrorHistory);
        }
    }
    
    /**
     * Gets error history
     */
    getErrorHistory(category = null, limit = 10) {
        let errors = this.errors;
        
        if (category) {
            errors = errors.filter(e => e.category === category);
        }
        
        return errors.slice(-limit);
    }
    
    /**
     * Clears error history
     */
    clearHistory() {
        this.errors = [];
    }
    
    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Setup global error handlers
     */
    setupGlobalHandlers() {
        if (typeof window !== 'undefined') {
            window.addEventListener('unhandledrejection', event => {
                this.logError(
                    this.codes.SYSTEM,
                    'Unhandled promise rejection',
                    {
                        reason: event.reason,
                        promise: event.promise,
                        severity: this.severity.ERROR
                    }
                );
            });
            
            window.addEventListener('error', event => {
                this.logError(
                    this.codes.SYSTEM,
                    'Uncaught error',
                    {
                        message: event.message,
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno,
                        error: event.error,
                        severity: this.severity.ERROR
                    }
                );
            });
        }
    }
    
    /**
     * Placeholder reconnect function (implement based on your socket system)
     */
    async reconnect(socketId) {
        // This should be implemented based on your socket system
        return { success: false };
    }
    
    /**
     * Placeholder session refresh function
     */
    async attemptSessionRefresh(error) {
        // This should be implemented based on your session system
        return { recovered: false, error: error };
    }
    
    /**
     * Handle rate limiting
     */
    async handleRateLimit(error) {
        const retryAfter = error.details.retryAfter || 5000;
        await this.delay(retryAfter);
        return { recovered: true, retryAfter: retryAfter };
    }
    
    /**
     * Get error statistics
     */
    getStatistics() {
        const stats = {
            total: this.errors.length,
            byCategory: {},
            bySeverity: {},
            recent: this.errors.slice(-5)
        };
        
        // Count by category
        Object.values(this.categories).forEach(category => {
            stats.byCategory[category] = this.errors.filter(e => e.category === category).length;
        });
        
        // Count by severity
        Object.entries(this.severity).forEach(([name, level]) => {
            stats.bySeverity[name] = this.errors.filter(e => e.severity === level).length;
        });
        
        return stats;
    }
}

// Create singleton instance
export const raidErrorHandler = new RaidErrorHandler();

// ===================================================================
// Future Scripts Needed:
// 1. client/src/raid/RaidClientCore.js - Core client with error handling
// 2. client/src/raid/ui/RaidUIController.js - UI controller with error display
// 3. server/raid/core/RaidValidation.js - Input validation module
// 4. shared/raid/RaidConstants.js - Shared constants and configurations
// ===================================================================