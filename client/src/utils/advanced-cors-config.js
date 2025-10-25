/**
 * Advanced CORS Configuration System
 * Integrated into main project for deck/card image loading
 * Uses global variables: CORS_ALLOWED_ORIGINS, CORS_LIMITED_ORIGINS, CORS_BLOCKED_ORIGINS, CORS_ORIGINS_LIMITS
 */

// Global CORS Configuration - will be loaded from server API
// Client-side starts with permissive config, gets updated from server
const corsConfig = {
  allowedOrigins: [],
  limitedOrigins: [],
  blockedOrigins: [],
  originsLimits: { default: 5 },
  enabled: false, // CORS is disabled by default - allows all images
  debugMode: false,
  consoleLogging: false,
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
      console.log('🔒 CORS config fallback: server API unavailable');
    }

    // Fallback to environment variables
    this.config = { ...corsConfig };
  }

  /**
   * Ensure config is initialized before any operation
   */
  ensureConfig() {
    if (!this.config) {
      this.config = { ...corsConfig };
    }
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
    this.ensureConfig(); // Ensure config is initialized

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
      return {
        allowed: true,
        reason: 'In allowed origins',
        category: 'allowed',
        domain,
      };
    }

    // 2. Check if domain is in BLOCKED_ORIGINS (always blocked)
    if (this.matchesPattern(domain, this.config.blockedOrigins)) {
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
        return {
          allowed: false,
          reason: `Exceeded limit (${currentCount}/${limit})`,
          category: 'limited',
          domain,
          currentCount,
          maxImages: limit,
        };
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
      return {
        allowed: false,
        reason: `Exceeded default limit (${currentCount}/${defaultLimit})`,
        category: 'default',
        domain,
        currentCount,
        maxImages: defaultLimit,
      };
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
    this.ensureConfig(); // Ensure config is initialized

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

    // Counts cleared silently
  }

  /**
   * Reset counts for specific domain
   */
  resetDomainCount(domain) {
    this.imageCounts.delete(domain);
    this.requestCounts.delete(domain);

    // Domain counts cleared silently
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
