import { advancedCORSManager } from './advanced-cors-config.js';

/**
 * Protected Image Loader
 * Integrates with Advanced CORS Configuration system
 * Hooks into existing deck/card image loading
 */
class ProtectedImageLoader {
  constructor() {
    this.fallbackImage = '/src/assets/cardback.png'; // Your existing cardback
    this.blockedImages = new Set(); // Track blocked images to avoid repeated checks
  }

  /**
   * Check if an image should be loaded based on CORS rules
   * This is the main function that hooks into your existing image loading
   */
  async loadImage(imageUrl, cardData = null) {
    if (!imageUrl) {
      return this.fallbackImage;
    }

    // Check CORS rules (only if CORS manager is available and enabled)
    if (advancedCORSManager && advancedCORSManager.config && advancedCORSManager.config.enabled) {
      const corsCheck = advancedCORSManager.checkImageRequest(imageUrl);
      
      if (!corsCheck.allowed) {
        // Image is blocked by CORS rules - return fallback image (no console logging)
        this.blockedImages.add(imageUrl);
        return this.fallbackImage;
      }

      // Image is allowed - no console logging unless debug mode
      if (advancedCORSManager.config.debugMode) {
        console.log(`✅ CORS Allowed: ${imageUrl} - ${corsCheck.reason}`);
      }
    }
    
    // Always return original URL (CORS is just for notifications/logging)
    return imageUrl;
  }

  /**
   * Preload multiple images with CORS checking
   * Useful for deck imports - limits images per domain
   */
  async preloadImages(imageUrls, cardDataArray = []) {
    const results = [];
    const domainCounts = new Map(); // Track counts per domain during import
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const cardData = cardDataArray[i] || null;
      
      try {
        // Extract domain for counting
        let domain;
        try {
          domain = new URL(imageUrl).hostname;
        } catch (error) {
          domain = 'unknown';
        }
        
        // Check if we've already loaded max images from this domain during import
        const currentCount = domainCounts.get(domain) || 0;
        
        // Get the limit from CORS configuration
        let maxImages = 5; // Default fallback
        if (advancedCORSManager && advancedCORSManager.config) {
          // Check for specific domain limit first
          for (const [pattern, limit] of Object.entries(advancedCORSManager.config.originsLimits)) {
            if (pattern === 'default') continue;
            
            if (pattern.includes('*')) {
              const regexPattern = pattern.replace(/\*/g, '.*');
              const regex = new RegExp(`^${regexPattern}$`, 'i');
              if (regex.test(domain)) {
                maxImages = limit;
                break;
              }
            } else if (domain === pattern) {
              maxImages = limit;
              break;
            }
          }
          
          // Use default limit if no specific limit found
          if (maxImages === 5) {
            maxImages = advancedCORSManager.config.originsLimits.default || 5;
          }
        }
        
        if (currentCount >= maxImages) {
          // Skip this image - we've already loaded 5 from this domain
          results.push({
            originalUrl: imageUrl,
            allowedUrl: this.fallbackImage,
            blocked: true,
            reason: `Import limit reached (${currentCount}/${maxImages})`
          });
          continue;
        }
        
        // Load the image and increment count
        const allowedUrl = await this.loadImage(imageUrl, cardData);
        domainCounts.set(domain, currentCount + 1);
        
        results.push({
          originalUrl: imageUrl,
          allowedUrl: allowedUrl,
          blocked: false,
          reason: 'Allowed'
        });
      } catch (error) {
        results.push({
          originalUrl: imageUrl,
          allowedUrl: this.fallbackImage,
          blocked: true,
          reason: 'Error loading image'
        });
      }
    }
    
    return results;
  }

  /**
   * Check if an image is currently blocked
   */
  isImageBlocked(imageUrl) {
    return this.blockedImages.has(imageUrl);
  }

  /**
   * Clear blocked images cache
   */
  clearBlockedCache() {
    this.blockedImages.clear();
  }

  /**
   * Get sanitized CORS status for debugging
   */
  getCORSStatus() {
    return advancedCORSManager.getStatus();
  }
}

// Create singleton instance
const protectedImageLoader = new ProtectedImageLoader();

// Export for use in existing code
export { ProtectedImageLoader, protectedImageLoader };

// Make globally accessible for debugging (sanitized)
if (typeof window !== 'undefined') {
  window.protectedImageLoader = {
    getCORSStatus: () => protectedImageLoader.getCORSStatus(),
    clearBlockedCache: () => protectedImageLoader.clearBlockedCache(),
    isImageBlocked: (url) => protectedImageLoader.isImageBlocked(url)
  };
}
