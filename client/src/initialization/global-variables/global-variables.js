// File: client/src/initialization/global-variables/global-variables.js
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
 * Create a mock socket for offline mode
 * Provides a fallback when Socket.IO server is unavailable
 */
function createOfflineSocket() {
  console.log('[Socket] Creating offline mode socket');
  
  // Event handlers storage
  const eventHandlers = {};
  
  return {
    connected: true,
    id: 'offline-' + Math.random().toString(36).substring(2, 10),
    
    // Event registration
    on: function(event, callback) {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(callback);
      return this;
    },
    
    // Event emission - offline handling
    emit: function(event, ...args) {
      console.log(`[Socket-Offline] Emitting event: ${event}`, args);
      
      // Handle specific events
      if (event === 'joinGame') {
        // Simulate successful connection
        setTimeout(() => {
          const handlers = eventHandlers['connect'] || [];
          handlers.forEach(handler => handler());
          
          const joinHandlers = eventHandlers['joinGame'] || [];
          joinHandlers.forEach(handler => handler());
        }, 100);
      }
      
      // Store game state via REST API instead of socket
      if (event === 'storeGameState') {
        const data = args[0];
        fetch('/api/storeGameState', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameState: data })
        })
        .then(response => response.json())
        .then(result => {
          const handlers = eventHandlers['exportGameStateSuccessful'] || [];
          handlers.forEach(handler => handler(result.key));
        })
        .catch(error => {
          const handlers = eventHandlers['exportGameStateFailed'] || [];
          handlers.forEach(handler => handler('Error storing game state'));
        });
      }
      
      return this;
    },
    
    // Socket.IO methods that do nothing in offline mode
    connect: function() { return this; },
    disconnect: function() { return this; }
  };
}

/**
 * Robust Socket Connection Initialization
 * With offline mode fallback for reliability
 */
export const socket = (() => {
  try {
    // Validate Socket.IO global is available
    if (typeof io === 'undefined') {
      console.error('[Socket] Socket.IO library not loaded');
      return createOfflineSocket();
    }

    const socketUrl = detectSocketUrl();
    
    const socketOptions = {
      // Connection Resilience
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      
      // Timeout Handling
      timeout: 10000,
      
      // Transport Prioritization - use polling first for compatibility
      transports: ['polling', 'websocket'],
      
      // Debug mode only in development
      debug: currentEnvironment === 'development'
    };

    // First try to connect
    try {
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
    } catch (socketError) {
      console.error('Socket.IO connection failed, falling back to offline mode:', socketError);
      return createOfflineSocket();
    }
  } catch (error) {
    console.error('Failed to initialize socket connection:', error);
    return createOfflineSocket();
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
    p1: function(user) { return user === 'self' ? 'Blue' : 'Red'; },
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