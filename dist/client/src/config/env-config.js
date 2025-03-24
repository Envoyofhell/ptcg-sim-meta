/**
 * Environment Configuration Module for PTCG-Sim-Meta
 *
 * This module provides environment-specific configuration settings
 * and detects the current environment automatically.
 *
 * File: client/src/config/env-config.js
 */

/**
 * Environment configuration object
 * Contains settings for different deployment environments
 */
export const ENV = {
  /**
   * Development environment settings
   * Used for development and testing
   */
  DEVELOPMENT: {
    // Client and server URLs
    CLIENT_URL: 'https://ptcg-sim-meta-dev.pages.dev',
    WORKER_URL: 'https://ptcg-sim-meta-dev.jasonh1993.workers.dev',
    SOCKET_URL: 'https://ptcg-sim-meta-dev.jasonh1993.workers.dev',

    // Database configuration (used server-side)
    DATABASE_URL: process.env?.DEV_DATABASE_URL || '',

    // Logging level
    LOG_LEVEL: 'debug',

    // API paths
    API_PATH: '/api',
    SOCKET_PATH: '/socket.io',

    // Feature flags
    FEATURES: {
      MULTIPLAYER: true,
      OFFLINE_MODE: true,
      DEBUG_TOOLS: true,
      EXPERIMENTAL: true,
    },
  },

  /**
   * Production environment settings
   * Used for the live application
   */
  PRODUCTION: {
    // Client and server URLs
    CLIENT_URL: 'https://ptcg-sim-meta.pages.dev',
    WORKER_URL: 'https://ptcg-sim-meta.jasonh1993.workers.dev',
    SOCKET_URL: 'https://ptcg-sim-meta.jasonh1993.workers.dev',

    // Database configuration (used server-side)
    DATABASE_URL: process.env?.PRODUCTION_DATABASE_URL || '',

    // Logging level
    LOG_LEVEL: 'info',

    // API paths
    API_PATH: '/api',
    SOCKET_PATH: '/socket.io',

    // Feature flags
    FEATURES: {
      MULTIPLAYER: true,
      OFFLINE_MODE: true,
      DEBUG_TOOLS: false,
      EXPERIMENTAL: false,
    },
  },

  /**
   * Local development environment settings
   * Used when running locally
   */
  LOCAL: {
    // Client and server URLs
    CLIENT_URL: 'http://localhost:3000',
    WORKER_URL: 'http://localhost:4000',
    SOCKET_URL: 'http://localhost:4000',

    // Database configuration (used server-side)
    DATABASE_URL: process.env?.LOCAL_DATABASE_URL || '',

    // Logging level
    LOG_LEVEL: 'debug',

    // API paths
    API_PATH: '/api',
    SOCKET_PATH: '/socket.io',

    // Feature flags
    FEATURES: {
      MULTIPLAYER: true,
      OFFLINE_MODE: true,
      DEBUG_TOOLS: true,
      EXPERIMENTAL: true,
    },
  },

  /**
   * Detect current environment
   * @returns {Object} Current environment configuration
   */
  detect() {
    // For client-side detection
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return this.LOCAL;
      } else if (hostname === 'ptcg-sim-meta-dev.pages.dev') {
        return this.DEVELOPMENT;
      } else if (hostname === 'ptcg-sim-meta.pages.dev') {
        return this.PRODUCTION;
      }
    }

    // For server-side or fallback detection
    return process.env?.NODE_ENV === 'development'
      ? this.DEVELOPMENT
      : this.PRODUCTION;
  },

  /**
   * Get current environment configuration
   * @returns {Object} Environment-specific configuration
   */
  get current() {
    return this.detect();
  },

  /**
   * Check if running in a specific environment
   * @param {string} env - Environment name to check
   * @returns {boolean} Whether running in the specified environment
   */
  is(env) {
    const current = this.detect();

    switch (env.toLowerCase()) {
      case 'development':
      case 'dev':
        return current === this.DEVELOPMENT;

      case 'production':
      case 'prod':
        return current === this.PRODUCTION;

      case 'local':
        return current === this.LOCAL;

      default:
        return false;
    }
  },

  /**
   * Get a configuration value
   * @param {string} key - Configuration key path (dot notation)
   * @param {*} defaultValue - Default value if not found
   * @returns {*} Configuration value or default
   */
  get(key, defaultValue = null) {
    const current = this.detect();

    // Handle dot notation for nested properties
    const path = key.split('.');
    let value = current;

    for (const part of path) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return defaultValue;
      }
    }

    return value ?? defaultValue;
  },
};

// Export the detected environment for convenience
export const currentEnv = ENV.detect();

// Export individual environment constants
export const isDevelopment = ENV.is('development');
export const isProduction = ENV.is('production');
export const isLocal = ENV.is('local');

// Export common configuration values
export const CONFIG = {
  CLIENT_URL: currentEnv.CLIENT_URL,
  WORKER_URL: currentEnv.WORKER_URL,
  SOCKET_URL: currentEnv.SOCKET_URL,
  LOG_LEVEL: currentEnv.LOG_LEVEL,
  API_PATH: currentEnv.API_PATH,
  SOCKET_PATH: currentEnv.SOCKET_PATH,
  FEATURES: currentEnv.FEATURES,
};

export default ENV;
