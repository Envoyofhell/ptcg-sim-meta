/**
 * Advanced CORS Configuration System
 * Integrated into main project for deck/card image loading
 * Uses global variables: CORS_ALLOWED_ORIGINS, CORS_LIMITED_ORIGINS, CORS_BLOCKED_ORIGINS, CORS_ORIGINS_LIMITS
 */

// Global CORS Configuration - reads from environment variables
const corsConfig = {
  // Your existing secret variable (always allowed)
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [
        'https://admin.socket.io',
        'https://ptcg-sim-meta.pages.dev',
        'http://localhost:3000',
        'https://meta-ptcg.org',
        'https://test.meta-ptcg.org',
        'https://*.onrender.com',
      ],

  // Domains to limit after X images
  limitedOrigins: process.env.CORS_LIMITED_ORIGINS
    ? process.env.CORS_LIMITED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['*.duckdns.org', '*.ngrok.io'],

  // Domains to always block
  blockedOrigins: process.env.CORS_BLOCKED_ORIGINS
    ? process.env.CORS_BLOCKED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['malicious-site.com', 'spam-domain.org', 'phishing-site.net'],

  // JSON object with limits per domain (default: 5)
  originsLimits: process.env.CORS_ORIGINS_LIMITS
    ? JSON.parse(process.env.CORS_ORIGINS_LIMITS)
    : {
        '*.duckdns.org': 5,
        '*.ngrok.io': 3,
        default: 5,
      },

  // System configuration
  enabled: process.env.CORS_ENABLED === 'true',
  debugMode: process.env.CORS_DEBUG_MODE === 'true',
  consoleLogging: process.env.CORS_CONSOLE_LOGGING === 'true',
};

/**
 * Advanced CORS Manager
 * Handles CORS logic for deck/card image loading
 */
class AdvancedCORSManager {
  constructor() {
    this.imageCounts = new Map();
    this.requestCounts = new Map();
    this.lastResetTime = Date.now();
    this.resetInterval = 60000; // Reset counts every minute

    // Load configuration asynchronously
    this.loadConfig().then(() => {
      if (corsConfig.debugMode) {
        console.log('🔒 Advanced CORS Manager initialized:', {
          enabled: corsConfig.enabled,
          allowedOrigins: corsConfig.allowedOrigins.length,
          limitedOrigins: corsConfig.limitedOrigins.length,
          blockedOrigins: corsConfig.blockedOrigins.length,
        });
      }
    });
  }

  /**
   * Load configuration from environment variables or server API
   */
  async loadConfig() {
    // Try to load from server API first (if available)
    try {
      const response = await fetch('/api/cors/config');
      if (response.ok) {
        const serverConfig = await response.json();
        this.config = { ...corsConfig, ...serverConfig };

        if (this.config.debugMode) {
          console.log('🔒 CORS config loaded from server API');
        }
        return;
      }
    } catch (error) {
      // Fallback to environment variables
      if (this.config.debugMode) {
        console.log(
          '🔒 CORS config loaded from environment variables (server API unavailable)'
        );
      }
    }

    // Fallback to environment variables
    this.config = { ...corsConfig };
  }

  /**
   * Check if domain matches any pattern in a list
   */
  matchesPattern(domain, patterns) {
    return patterns.some((pattern) => {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(domain);
      }
      return domain === pattern;
    });
  }

  /**
   * Get image limit for a domain
   */
  getImageLimit(domain) {
    // Check for specific domain limit
    for (const [pattern, limit] of Object.entries(this.config.originsLimits)) {
      if (pattern === 'default') continue;

      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        if (regex.test(domain)) {
          return limit;
        }
      } else if (domain === pattern) {
        return limit;
      }
    }

    // Return default limit
    return this.config.originsLimits.default || 5;
  }

  /**
   * Get current image count for domain
   */
  getImageCount(domain) {
    return this.imageCounts.get(domain) || 0;
  }

  /**
   * Increment image count for domain
   */
  incrementImageCount(domain) {
    const current = this.imageCounts.get(domain) || 0;
    this.imageCounts.set(domain, current + 1);
    return current + 1;
  }

  /**
   * Reset counts if needed
   */
  resetCountsIfNeeded() {
    const now = Date.now();
    if (now - this.lastResetTime > this.resetInterval) {
      this.imageCounts.clear();
      this.requestCounts.clear();
      this.lastResetTime = now;

      if (this.config.debugMode) {
        console.log('🔄 CORS counts reset');
      }
    }
  }

  /**
   * Main CORS check function for image URLs
   * This is the main function that hooks into your existing image loading
   */
  checkImageRequest(imageUrl) {
    // Reset counts if needed
    this.resetCountsIfNeeded();

    // If CORS is disabled, allow everything
    if (!this.config.enabled) {
      return { allowed: true, reason: 'CORS disabled' };
    }

    // Extract domain from image URL
    let domain;
    try {
      domain = new URL(imageUrl).hostname;
    } catch (error) {
      // If URL is invalid, allow it (let the browser handle the error)
      return { allowed: true, reason: 'Invalid URL - allowing' };
    }

    // 1. Check if domain is in ALLOWED_ORIGINS (always allowed)
    if (this.matchesPattern(domain, this.config.allowedOrigins)) {
      if (this.config.consoleLogging) {
        console.log(`✅ CORS ALLOWED: ${domain} - In allowed origins list`);
      }
      return {
        allowed: true,
        reason: 'In allowed origins',
        category: 'allowed',
        domain,
      };
    }

    // 2. Check if domain is in BLOCKED_ORIGINS (always blocked)
    if (this.matchesPattern(domain, this.config.blockedOrigins)) {
      if (this.config.consoleLogging) {
        console.log(`❌ CORS BLOCKED: ${domain} - In blocked origins list`);
      }
      return {
        allowed: false,
        reason: 'In blocked origins',
        category: 'blocked',
        domain,
      };
    }

    // 3. Check if domain is in LIMITED_ORIGINS (block after X images)
    if (this.matchesPattern(domain, this.config.limitedOrigins)) {
      const currentCount = this.incrementImageCount(domain);
      const limit = this.getImageLimit(domain);

      if (currentCount > limit) {
        if (this.config.consoleLogging) {
          console.log(
            `❌ CORS LIMITED: ${domain} - Exceeded limit (${currentCount}/${limit})`
          );
        }
        return {
          allowed: false,
          reason: `Exceeded limit (${currentCount}/${limit})`,
          category: 'limited',
          domain,
          currentCount,
          maxImages: limit,
        };
      }

      if (this.config.consoleLogging) {
        console.log(
          `⚠️ CORS LIMITED: ${domain} - Within limit (${currentCount}/${limit})`
        );
      }
      return {
        allowed: true,
        reason: `Within limit (${currentCount}/${limit})`,
        category: 'limited',
        domain,
        currentCount,
        maxImages: limit,
      };
    }

    // 4. Default behavior for unknown domains (allow with default limit)
    const currentCount = this.incrementImageCount(domain);
    const defaultLimit = this.config.originsLimits.default || 5;

    if (currentCount > defaultLimit) {
      if (this.config.consoleLogging) {
        console.log(
          `❌ CORS DEFAULT: ${domain} - Exceeded default limit (${currentCount}/${defaultLimit})`
        );
      }
      return {
        allowed: false,
        reason: `Exceeded default limit (${currentCount}/${defaultLimit})`,
        category: 'default',
        domain,
        currentCount,
        maxImages: defaultLimit,
      };
    }

    if (this.config.consoleLogging) {
      console.log(
        `✅ CORS DEFAULT: ${domain} - Within default limit (${currentCount}/${defaultLimit})`
      );
    }
    return {
      allowed: true,
      reason: `Within default limit (${currentCount}/${defaultLimit})`,
      category: 'default',
      domain,
      currentCount,
      maxImages: defaultLimit,
    };
  }

  /**
   * Get current configuration status (sanitized for client)
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      debugMode: this.config.debugMode,
      consoleLogging: this.config.consoleLogging,
      // Don't expose actual domain lists for security
      allowedOriginsCount: this.config.allowedOrigins.length,
      limitedOriginsCount: this.config.limitedOrigins.length,
      blockedOriginsCount: this.config.blockedOrigins.length,
      // Only show limits structure, not actual domains
      hasCustomLimits: Object.keys(this.config.originsLimits).length > 1,
      imageCounts: Object.fromEntries(this.imageCounts),
      requestCounts: Object.fromEntries(this.requestCounts),
      lastReset: new Date(this.lastResetTime).toISOString(),
    };
  }

  /**
   * Clear all counts
   */
  clearCounts() {
    this.imageCounts.clear();
    this.requestCounts.clear();
    this.lastResetTime = Date.now();

    if (this.config.consoleLogging) {
      console.log('🔄 CORS counts cleared');
    }
  }

  /**
   * Reset counts for specific domain
   */
  resetDomainCount(domain) {
    this.imageCounts.delete(domain);
    this.requestCounts.delete(domain);

    if (this.config.consoleLogging) {
      console.log(`🔄 CORS counts cleared for domain: ${domain}`);
    }
  }
}

// Create singleton instance
const advancedCORSManager = new AdvancedCORSManager();

// Export for use in other modules
export { corsConfig, AdvancedCORSManager, advancedCORSManager };

// Make globally accessible for debugging (sanitized)
if (typeof window !== 'undefined') {
  // Only expose safe methods, not configuration
  window.advancedCORSManager = {
    getStatus: () => advancedCORSManager.getStatus(),
    clearCounts: () => advancedCORSManager.clearCounts(),
    resetDomainCount: (domain) => advancedCORSManager.resetDomainCount(domain),
  };
  // Don't expose corsConfig at all
}
