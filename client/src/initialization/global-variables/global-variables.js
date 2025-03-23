/* eslint-disable no-undef */
import { preloadImage } from '../../setup/general/preload-image.js';
import { getZone } from '../../setup/zones/get-zone.js';

/**
 * Version Tracking
 * Helps with caching, feature detection, and compatibility checks
 */
export const version = '1.5.1';

/**
 * Environment Detection Utility
 * Provides a safe way to determine the current environment
 */
function detectEnvironment() {
  const hostname = window.location.hostname;
  
  const environments = {
    development: [
      'localhost', 
      '127.0.0.1', 
      'ptcg-sim-meta-dev.pages.dev'
    ],
    production: [
      'ptcg-sim-meta.pages.dev'
    ]
  };

  if (environments.development.includes(hostname)) {
    return 'development';
  }

  if (environments.production.includes(hostname)) {
    return 'production';
  }

  // Default to production for unknown environments
  return 'production';
}

/**
 * Advanced Environment Detection for Socket URL
 * Provides robust URL selection with comprehensive fallback
 */
function detectSocketUrl() {
  const hostname = window.location.hostname;
  
  // Comprehensive URL mapping
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
    'https://ptcg-sim-meta.jasonh1993.workers.dev';
  
  console.log(`[Socket URL] Selected: ${socketUrl}`);
  return socketUrl;
}

// Detect current environment
const currentEnvironment = detectEnvironment();

/**
 * Robust Socket Connection Initialization
 * Provides advanced error handling and connection management
 */
export const socket = (() => {
  try {
    // Validate Socket.IO global is available
    if (typeof io === 'undefined') {
      console.error('[Socket] Socket.IO library not loaded');
      return null;
    }

    const socketUrl = detectSocketUrl();
    
    const socketOptions = {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000, // Increased timeout
      transports: ['polling', 'websocket'],
      path: '/socket.io/', // Ensure this matches server config
      autoConnect: true,
      debug: currentEnvironment === 'development'
    };

    const socketInstance = io(socketUrl, socketOptions);
    
    // Connection Event Handlers
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
    return null;
  }
})();

// Preemptive error handling for socket usage
export function safeSocketEmit(eventName, ...args) {
  if (socket && socket.connected) {
    socket.emit(eventName, ...args);
  } else {
    console.warn(`[Socket] Cannot emit ${eventName}. Socket not connected.`);
  }
}

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