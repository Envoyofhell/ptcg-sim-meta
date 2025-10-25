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

    // Check CORS rules
    const corsCheck = advancedCORSManager.checkImageRequest(imageUrl);
    
    if (!corsCheck.allowed) {
      // Image is blocked by CORS rules
      this.blockedImages.add(imageUrl);
      
      if (corsConfig.debugMode) {
        console.log(`🚫 CORS Blocked: ${imageUrl} - ${corsCheck.reason}`);
      }
      
      // Return fallback image
      return this.fallbackImage;
    }

    // Image is allowed, return original URL
    if (corsConfig.debugMode) {
      console.log(`✅ CORS Allowed: ${imageUrl} - ${corsCheck.reason}`);
    }
    
    return imageUrl;
  }

  /**
   * Preload multiple images with CORS checking
   * Useful for deck imports
   */
  async preloadImages(imageUrls, cardDataArray = []) {
    const results = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      const cardData = cardDataArray[i] || null;
      
      try {
        const allowedUrl = await this.loadImage(imageUrl, cardData);
        results.push({
          originalUrl: imageUrl,
          allowedUrl: allowedUrl,
          blocked: !corsCheck.allowed,
          reason: corsCheck.reason || 'Allowed'
        });
      } catch (error) {
        results.push({
          originalUrl: imageUrl,
          allowedUrl: this.fallbackImage,
          blocked: true,
          reason: 'Error loading image',
          error: error.message
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
