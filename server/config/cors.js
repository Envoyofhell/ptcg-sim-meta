/**
 * CORS configuration for PTCG-Sim-Meta
 * 
 * This module defines CORS settings to handle cross-origin requests
 * between Cloudflare Pages (client) and Render.com (server)
 */

// Define default allowed origins
export const DEFAULT_ALLOWED_ORIGINS = [
    'https://ptcg-sim-meta.pages.dev',  // Cloudflare Pages production
    'http://localhost:3000',            // Local development frontend
    'http://localhost:4000',            // Local development backend
  ];
  
  /**
   * Get CORS configuration options
   * 
   * @param {Array<string>} additionalOrigins - Additional origins to allow
   * @returns {Object} - CORS configuration object
   */
  export function getCorsOptions(additionalOrigins = []) {
    // Combine default and additional origins
    const allowedOrigins = [...DEFAULT_ALLOWED_ORIGINS, ...additionalOrigins];
    
    return {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) {
          return callback(null, true);
        }
        
        // Check if origin is allowed
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.warn(`CORS blocked request from origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400, // 24 hours
    };
  }
  
  /**
   * Get development CORS configuration (allows all origins)
   * 
   * @returns {Object} - Development CORS configuration object
   */
  export function getDevCorsOptions() {
    return {
      origin: true, // Allow all origins in development
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: true
    };
  }
  
  /**
   * Determine if we should use development CORS settings
   * 
   * @returns {boolean} - True if we should use development settings
   */
  export function isDevelopmentEnvironment() {
    return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  }
  
  /**
   * Get the appropriate CORS options based on environment
   * 
   * @param {Array<string>} additionalOrigins - Additional origins to allow
   * @returns {Object} - CORS configuration object
   */
  export function getAppropriateConfig(additionalOrigins = []) {
    if (isDevelopmentEnvironment()) {
      return getDevCorsOptions();
    } else {
      return getCorsOptions(additionalOrigins);
    }
  }