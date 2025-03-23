/* eslint-disable no-undef */
import { preloadImage } from '../../setup/general/preload-image.js';
import { getZone } from '../../setup/zones/get-zone.js';

/**
 * Version Tracking
 * Helps with caching, feature detection, and compatibility checks
 */
export const version = '1.5.1';

/**
 * Advanced Environment Detection
 * Provides robust socket URL selection with multiple fallback strategies
 * 
 * Key Features:
 * - Dynamic environment detection
 * - Secure URL selection
 * - Fallback mechanisms
 * - Logging for debugging
 */
function detectSocketUrl() {
  // Get current hostname for environment determination
  const hostname = window.location.hostname;
  
  // Comprehensive logging for debugging environment detection
  console.log(`[Socket URL Detection] Current Hostname: ${hostname}`);
  
  // Environment-specific URL mapping
  const environmentUrls = {
    // Local development
    'localhost': 'http://localhost:4000',
    '127.0.0.1': 'http://localhost:4000',
    
    // Development Cloudflare Pages
    'ptcg-sim-meta-dev.pages.dev': 'https://ptcg-sim-meta-dev.jasonh1993.workers.dev',
    
    // Production Cloudflare Pages
    'ptcg-sim-meta.pages.dev': 'https://ptcg-sim-meta.jasonh1993.workers.dev'
  };
  
  // Secure URL selection with fallback
  const socketUrl = environmentUrls[hostname] || 
    // Fallback to production worker if no match
    'https://ptcg-sim-meta.jasonh1993.workers.dev';
  
  console.log(`[Socket URL Detection] Selected URL: ${socketUrl}`);
  return socketUrl;
}

// Detect and create socket connection
const socketUrl = detectSocketUrl();

/**
 * Socket.IO Connection with Enhanced Configuration
 * 
 * Features:
 * - Automatic reconnection
 * - Timeout handling
 * - Connection state logging
 */
export const socket = (() => {
  try {
    const socketInstance = io(socketUrl, {
      // Connection Resilience
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      
      // Timeout Handling
      timeout: 5000,
      
      // Transport Prioritization
      transports: ['websocket', 'polling'],
      
      // Connection Debugging
      debug: process.env.NODE_ENV === 'development'
    });
    
    // Connection Event Logging
    socketInstance.on('connect', () => {
      console.log(`[Socket] Connected to ${socketUrl}`);
    });
    
    socketInstance.on('disconnect', (reason) => {
      console.warn(`[Socket] Disconnected: ${reason}`);
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error(`[Socket] Connection Error: ${error.message}`);
    });
    
    return socketInstance;
  } catch (error) {
    console.error('Failed to initialize socket connection:', error);
    // Fallback mechanism or error handling
    return null;
  }
})();

// HTML Element References
export const selfContainer = document.getElementById('selfContainer');
export const selfContainerDocument = selfContainer.contentWindow.document;
export const oppContainer = document.getElementById('oppContainer');
export const oppContainerDocument = oppContainer.contentWindow.document;

/**
 * System State Management
 * Centralized state tracking with enhanced type safety and logging
 */
export const systemState = {
  // Existing properties with added type hints and validation
  coachingMode: false,
  isUndoInProgress: false,
  
  // Counter tracking with safeguards
  _selfCounter: 0,
  get selfCounter() { return this._selfCounter; },
  set selfCounter(value) {
    if (typeof value !== 'number') {
      console.warn(`Invalid selfCounter value: ${value}`);
      return;
    }
    this._selfCounter = value;
  },
  
  // Expanded state tracking
  actionData: {
    self: [],
    opponent: [],
    spectator: []
  },
  
  // Advanced getter/setter patterns
  get initiator() {
    return selfContainer.classList.contains('self') ? 'self' : 'opp';
  },
  
  // Enhanced username handling
  usernames: {
    p1: (user) => user === 'self' ? 'Blue' : 'Red',
    p2Self: '',
    p2Opp: '',
    spectator: ''
  },
  
  // Deck and game state management
  decks: {
    self: '',
    p1Opp: '', // 1P mode opponent deck
    p2Opp: ''  // 2P mode opponent deck
  },
  
  // Card back management with URL validation
  cardBacks: {
    self: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
    p1Opp: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
    p2Opp: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png'
  }
};

// Preload default card back image
preloadImage(systemState.cardBacks.self);

// Background configuration with fallback
document.body.style.backgroundImage = `
  linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.75)), 
  url('https://static0.gamerantimages.com/wordpress/wp-content/uploads/wm/2025/03/pokemon-legends-z-a-totodile-with-lumiose-bg.jpg')
`;
document.body.style.backgroundPosition = '-200px 0';

/**
 * Mouse Click State Management
 * Enhanced tracking of selected game elements
 */
export const mouseClick = {
  cardIndex: '',
  zoneId: '',
  cardUser: '',
  playContainer: '',
  playContainerParent: '',
  selectingCard: false,
  
  // Advanced card retrieval with error handling
  get card() {
    try {
      if (!this.zoneId) return null;
      const zone = getZone(this.cardUser, this.zoneId);
      return zone.array[this.cardIndex] || null;
    } catch (error) {
      console.warn('Error retrieving card:', error);
      return null;
    }
  }
};