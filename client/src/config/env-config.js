export const ENV = {
    DEVELOPMENT: {
      CLIENT_URL: 'https://ptcg-sim-meta-dev.pages.dev',
      WORKER_URL: 'https://ptcg-sim-meta-dev.jasonh1993.workers.dev',
      SOCKET_URL: 'https://ptcg-sim-meta-dev.jasonh1993.workers.dev',
      DATABASE_URL: process.env.DEV_DATABASE_URL,
      LOG_LEVEL: 'debug'
    },
    PRODUCTION: {
      CLIENT_URL: 'https://ptcg-sim-meta.pages.dev',
      WORKER_URL: 'https://ptcg-sim-meta.jasonh1993.workers.dev',
      SOCKET_URL: 'https://ptcg-sim-meta.jasonh1993.workers.dev',
      DATABASE_URL: process.env.PRODUCTION_DATABASE_URL,
      LOG_LEVEL: 'info'
    },
    LOCAL: {
      CLIENT_URL: 'http://localhost:3000',
      WORKER_URL: 'http://localhost:4000',
      SOCKET_URL: 'http://localhost:4000',
      DATABASE_URL: process.env.LOCAL_DATABASE_URL,
      LOG_LEVEL: 'debug'
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
      return process.env.NODE_ENV === 'development' 
        ? this.DEVELOPMENT 
        : this.PRODUCTION;
    },
  
    /**
     * Get current environment configuration
     * @returns {Object} Environment-specific configuration
     */
    get current() {
      return this.detect();
    }
  };
  
  // Export the detected environment
  export const currentEnv = ENV.detect();