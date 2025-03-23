/**
 * Global Variables Management
 * 
 * This module handles the initialization and management of global state variables,
 * socket connections, and element references that are used throughout the application.
 * 
 * The code is structured to avoid circular dependencies and ensure proper initialization.
 */

import { preloadImage } from '../../setup/general/preload-image.js';

// Logger singleton - available immediately for other modules to use
export const logger = {
  debugMode: false,
  
  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether debug logging is enabled
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  },
  
  /**
   * Log a message with the specified level
   * @param {string} message - Message to log
   * @param {string} level - Log level (info, warn, error, debug, success)
   * @param {Object} data - Optional data to include
   */
  log(message, level = 'info', data = null) {
    if (level === 'debug' && !this.debugMode) return;
    
    const timestamp = new Date().toISOString();
    let consoleMethod = console.log;
    let prefix = 'INFO';
    
    switch (level) {
      case 'error':
        consoleMethod = console.error;
        prefix = 'ERROR';
        break;
      case 'warn':
        consoleMethod = console.warn;
        prefix = 'WARNING';
        break;
      case 'debug':
        consoleMethod = console.debug;
        prefix = 'DEBUG';
        break;
      case 'success':
        prefix = 'SUCCESS';
        break;
    }
    
    const formattedMessage = `[${timestamp}] ${prefix}: ${message}`;
    
    if (data) {
      consoleMethod(formattedMessage, data);
    } else {
      consoleMethod(formattedMessage);
    }
    
    return { timestamp, level, message, data };
  }
};

/**
 * Creates and initializes the system state
 * @returns {Object} Fully initialized system state
 */
export function initializeSystemState() {
  logger.log('Initializing system state', 'info');
  
  // Create system state with default values
  const state = {
    // Version tracking
    version: '1.5.1.1',
    buildTimestamp: BUILD_TIMESTAMP || new Date().toISOString(),
    
    // Connection state
    isTwoPlayer: false,
    roomId: '',
    isConnected: false,
    offlineMode: false,
    connectionAttempts: 0,
    maxConnectionAttempts: 5,
    
    // Game state tracking
    isUndoInProgress: false,
    isReplay: false,
    isImporting: false,
    
    // Action tracking
    exportActionData: [],
    replayActionData: [],
    actionData: {
      self: [],
      opponent: [],
      spectator: []
    },
    
    // Counter tracking with validation
    _selfCounter: 0,
    _oppCounter: 0,
    get selfCounter() { return this._selfCounter; },
    set selfCounter(value) {
      if (typeof value !== 'number') {
        logger.log(`Invalid selfCounter value: ${value}`, 'warn');
        return;
      }
      this._selfCounter = value;
    },
    get oppCounter() { return this._oppCounter; },
    set oppCounter(value) {
      if (typeof value !== 'number') {
        logger.log(`Invalid oppCounter value: ${value}`, 'warn');
        return;
      }
      this._oppCounter = value;
    },
    
    // Username management 
    usernames: {
      p1Self: 'Blue',
      p1Opp: 'Red',
      p2Self: '',
      p2Opp: '',
      spectator: ''
    },
    
    // Initiator accessor - determines who initiated an action
    get initiator() {
      try {
        return document.getElementById('selfContainer').classList.contains('self') ? 'self' : 'opp';
      } catch (error) {
        logger.log('Error determining initiator, defaulting to self', 'error');
        return 'self';
      }
    },
    
    // Deck management
    selfDeckData: '',
    p1OppDeckData: '',
    p2OppDeckData: '',
    
    // Feature flags
    coachingMode: false,
    debugMode: window.location.hostname.includes('localhost') || 
               window.location.hostname.includes('dev') ||
               window.location.search.includes('debug=true'),
    
    // Card back management with customization
    _cardBackSrc: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
    get cardBackSrc() { return this._cardBackSrc; },
    set cardBackSrc(value) {
      if (typeof value !== 'string' || !value.startsWith('http')) {
        logger.log(`Invalid card back URL: ${value}`, 'warn');
        return;
      }
      this._cardBackSrc = value;
      // Preload the new image
      preloadImage(value);
    },
    p1OppCardBackSrc: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
    p2OppCardBackSrc: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
    
    // Background settings
    defaultBackground: `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.75)), 
      url('https://static0.gamerantimages.com/wordpress/wp-content/uploads/wm/2025/03/pokemon-legends-z-a-totodile-with-lumiose-bg.jpg')`,
    customBackground: null,
    
    // Error handling
    lastError: null,
    errorCount: 0,
    
    // Storage management
    localStorageEnabled: false,
    sessionStorageEnabled: false,
    
    // Methods for state management
    reset() {
      this.exportActionData = [];
      this.replayActionData = [];
      this.actionData = {
        self: [],
        opponent: [],
        spectator: []
      };
      this._selfCounter = 0;
      this._oppCounter = 0;
      logger.log('System state reset', 'info');
    },
    
    /**
     * Switch to offline mode
     * @param {string} reason - Reason for switching to offline mode
     */
    enableOfflineMode(reason = 'Unknown reason') {
      if (this.offlineMode) return; // Already in offline mode
      
      this.offlineMode = true;
      logger.log(`Switching to offline mode: ${reason}`, 'warn');
      
      // Show notification to user
      this.displayOfflineModeNotification();
    },
    
    /**
     * Display offline mode notification
     */
    displayOfflineModeNotification() {
      const chatbox = document.getElementById('chatbox');
      if (!chatbox) return;
      
      const notification = document.createElement('div');
      notification.style.backgroundColor = '#fff3cd';
      notification.style.color = '#856404';
      notification.style.padding = '10px';
      notification.style.borderRadius = '5px';
      notification.style.margin = '10px 0';
      notification.style.cursor = 'pointer';
      
      notification.innerHTML = `
        <strong>Running in offline mode</strong>
        <p>Multiplayer features are limited. Single-player mode is fully available.</p>
        <p>Game states will be saved locally.</p>
        <p>Click to dismiss this message.</p>
      `;
      
      notification.addEventListener('click', () => {
        notification.style.display = 'none';
      });
      
      // Insert at the top of the chatbox
      chatbox.insertBefore(notification, chatbox.firstChild);
    }
  };
  
  // Initialize debug mode based on environment
  logger.setDebugMode(state.debugMode);
  
  // Check if storage is available (for offline mode)
  try {
    const testKey = '_ptcg_storage_test';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    state.localStorageEnabled = true;
    
    sessionStorage.setItem(testKey, 'test');
    sessionStorage.removeItem(testKey);
    state.sessionStorageEnabled = true;
  } catch (e) {
    logger.log('Local storage not available, some offline features may be limited', 'warn');
  }
  
  // Set initial background
  document.body.style.backgroundImage = state.defaultBackground;
  document.body.style.backgroundPosition = '-200px 0';
  
  // Preload default card back
  preloadImage(state.cardBackSrc);
  
  return state;
}

/**
 * Create Socket.IO connection with advanced error handling
 * 
 * @param {Object} systemState - System state object
 * @returns {Object} Socket.IO connection or offline fallback
 */
export function createSocketConnection(systemState) {
  try {
    logger.log('Initializing Socket.IO connection', 'info');
    
    // Detect environment and set appropriate socket URL
    const socketUrl = detectSocketUrl();
    logger.log(`Using Socket.IO URL: ${socketUrl}`, 'info');
    
    // Check if Socket.IO library is available
    if (typeof io === 'undefined') {
      logger.log('Socket.IO library not available, switching to offline mode', 'error');
      systemState.enableOfflineMode('Socket.IO library not available');
      return createOfflineModeSocket(systemState);
    }
    
    // Configure socket options for reliability
    const socketOptions = {
      reconnection: true,
      reconnectionAttempts: systemState.maxConnectionAttempts,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
      transports: ['polling', 'websocket'],
      forceNew: true,
      autoConnect: true,
      query: {
        version: systemState.version,
        client: 'web'
      }
    };
    
    // Create socket connection
    const socket = io(socketUrl, socketOptions);
    
    // Set up connection event handlers
    socket.on('connect', () => {
      logger.log(`Connected to Socket.IO server (ID: ${socket.id})`, 'success');
      systemState.isConnected = true;
      systemState.connectionAttempts = 0;
      systemState.offlineMode = false;
      
      // Display connection message in chatbox
      const chatbox = document.getElementById('chatbox');
      if (chatbox) {
        chatbox.innerHTML += '<div style="color: green; font-weight: bold">Connected to server</div>';
      }
      
      // Process any pending messages
      if (window.pendingSocketMessages && Array.isArray(window.pendingSocketMessages)) {
        logger.log(`Processing ${window.pendingSocketMessages.length} pending messages`, 'info');
        window.pendingSocketMessages.forEach(msg => {
          socket.emit(msg.event, ...msg.args);
        });
        window.pendingSocketMessages = [];
      }
    });
    
    socket.on('disconnect', (reason) => {
      logger.log(`Disconnected from Socket.IO server: ${reason}`, 'warn');
      systemState.isConnected = false;
      
      // Display disconnection message in chatbox
      const chatbox = document.getElementById('chatbox');
      if (chatbox) {
        chatbox.innerHTML += `<div style="color: red; font-weight: bold">Disconnected from server: ${reason}</div>`;
      }
      
      // Switch to offline mode for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'transport close') {
        // Server initiated disconnect, should switch to offline mode
        systemState.enableOfflineMode(`Server disconnected: ${reason}`);
      }
    });
    
    socket.on('connect_error', (error) => {
      systemState.connectionAttempts++;
      logger.log(`Socket.IO connection error (attempt ${systemState.connectionAttempts}/${systemState.maxConnectionAttempts}): ${error.message}`, 'error');
      
      // Switch to offline mode after max attempts
      if (systemState.connectionAttempts >= systemState.maxConnectionAttempts) {
        socket.disconnect();
        systemState.enableOfflineMode(`Failed after ${systemState.maxConnectionAttempts} attempts`);
        return createOfflineModeSocket(systemState);
      }
    });
    
    // Add heartbeat to keep connection alive
    setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 30000);
    
    return socket;
  } catch (error) {
    logger.log(`Error creating Socket.IO connection: ${error.message}`, 'error');
    systemState.enableOfflineMode(`Connection error: ${error.message}`);
    return createOfflineModeSocket(systemState);
  }
}

/**
 * Create an offline mode socket that mimics Socket.IO
 * 
 * @param {Object} systemState - System state object
 * @returns {Object} Offline mode socket
 */
function createOfflineModeSocket(systemState) {
  logger.log('Creating offline mode socket', 'info');
  
  // Initialize offline storage for pending messages
  if (!window.pendingSocketMessages) {
    window.pendingSocketMessages = [];
  }
  
  // Event handlers storage
  const eventHandlers = {};
  
  // Create a socket-like object
  const offlineSocket = {
    id: `offline-${Date.now()}`,
    connected: true,
    disconnected: false,
    
    /**
     * Register event handler
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     * @returns {Object} Socket for chaining
     */
    on(event, callback) {
      if (!eventHandlers[event]) {
        eventHandlers[event] = [];
      }
      eventHandlers[event].push(callback);
      return this;
    },
    
    /**
     * Remove event handler
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     * @returns {Object} Socket for chaining
     */
    off(event, callback) {
      if (eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter(cb => cb !== callback);
      }
      return this;
    },
    
    /**
     * Emit event
     * @param {string} event - Event name
     * @param {...any} args - Event arguments
     * @returns {Object} Socket for chaining
     */
    emit(event, ...args) {
      logger.log(`[Offline Mode] Emit ${event}`, 'debug', args);
      
      // Store for reconnection
      if (event !== 'heartbeat') {
        window.pendingSocketMessages.push({ event, args });
      }
      
      // Handle specific offline events
      switch (event) {
        case 'joinGame':
          setTimeout(() => {
            // Simulate connection event
            const connectHandlers = eventHandlers['connect'] || [];
            connectHandlers.forEach(handler => handler());
            
            // Simulate successful join
            const joinHandlers = eventHandlers['joinGame'] || [];
            joinHandlers.forEach(handler => handler());
          }, 500);
          break;
          
        case 'storeGameState':
          handleOfflineStoreGameState(args[0], eventHandlers);
          break;
          
        // Add handling for other important events here
      }
      
      return this;
    },
    
    /**
     * Connect socket
     * @returns {Object} Socket for chaining
     */
    connect() { 
      this.connected = true;
      this.disconnected = false;
      return this;
    },
    
    /**
     * Disconnect socket
     * @returns {Object} Socket for chaining
     */
    disconnect() { 
      this.connected = false;
      this.disconnected = true;
      return this;
    }
  };
  
  // Simulate a connection event after a delay
  setTimeout(() => {
    const connectHandlers = eventHandlers['connect'] || [];
    connectHandlers.forEach(handler => handler());
  }, 100);
  
  return offlineSocket;
}

/**
 * Handle offline storage of game state
 * 
 * @param {Object} gameState - Game state data
 * @param {Object} eventHandlers - Event handlers
 */
function handleOfflineStoreGameState(gameState, eventHandlers) {
  try {
    // Generate a key
    const key = `offline-${Math.random().toString(36).substring(2, 6)}`;
    
    // Store in localStorage if available
    if (typeof localStorage !== 'undefined') {
      const data = typeof gameState === 'string' ? gameState : JSON.stringify(gameState);
      localStorage.setItem(`ptcg-gamestate-${key}`, data);
      
      // Trigger success handler
      const handlers = eventHandlers['exportGameStateSuccessful'] || [];
      handlers.forEach(handler => handler(key));
      
      logger.log(`Game state saved locally with key: ${key}`, 'success');
    } else {
      throw new Error('LocalStorage not available');
    }
  } catch (error) {
    logger.log(`Error saving game state locally: ${error.message}`, 'error');
    
    // Trigger error handler
    const handlers = eventHandlers['exportGameStateFailed'] || [];
    handlers.forEach(handler => handler('Error storing game state: ' + error.message));
  }
}

/**
 * Detect appropriate Socket.IO URL based on current environment
 * 
 * @returns {string} Socket.IO server URL
 */
function detectSocketUrl() {
  const hostname = window.location.hostname;
  
  // Map hostnames to socket URLs
  const urls = {
    'localhost': 'http://localhost:4000',
    '127.0.0.1': 'http://localhost:4000',
    'ptcg-sim-meta-dev.pages.dev': 'https://ptcg-sim-meta-dev.jasonh1993.workers.dev',
    'ptcg-sim-meta.pages.dev': 'https://ptcg-sim-meta.jasonh1993.workers.dev'
  };
  
  // Get URL from map or use default
  return urls[hostname] || 'https://ptcg-sim-meta.jasonh1993.workers.dev';
}

/**
 * Initialize mouse click state
 * 
 * @param {Object} systemState - System state object
 * @returns {Object} Mouse click state
 */
export function createMouseClickState(systemState) {
  return {
    cardIndex: null,
    zoneId: null,
    cardUser: null,
    playContainer: null,
    playContainerParent: null,
    selectingCard: false,
    
    // Get the current card based on selection
    get card() {
      try {
        if (!this.zoneId || this.cardIndex === null) return null;
        
        // Dynamically import to avoid circular dependencies
        const { getZone } = require('../../setup/zones/get-zone.js');
        const zone = getZone(this.cardUser, this.zoneId);
        
        return zone?.array[this.cardIndex] || null;
      } catch (error) {
        logger.log(`Error retrieving card: ${error.message}`, 'error');
        return null;
      }
    },
    
    // Reset selection
    reset() {
      this.cardIndex = null;
      this.zoneId = null;
      this.cardUser = null;
      this.playContainer = null;
      this.playContainerParent = null;
      this.selectingCard = false;
    }
  };
}

/**
 * Safely emit a socket event with error handling
 * 
 * @param {string} eventName - Event name
 * @param {...any} args - Event arguments
 */
export function safeSocketEmit(eventName, ...args) {
  try {
    // Get socket from global scope
    const socket = window.socket;
    
    if (!socket) {
      logger.log(`Cannot emit ${eventName}: Socket not initialized`, 'error');
      
      // Store for later if we reconnect
      if (!window.pendingSocketMessages) {
        window.pendingSocketMessages = [];
      }
      window.pendingSocketMessages.push({ event: eventName, args });
      return;
    }
    
    if (socket.connected) {
      socket.emit(eventName, ...args);
    } else {
      logger.log(`Queuing ${eventName} event for when socket reconnects`, 'warn');
      
      // Store for reconnection
      if (!window.pendingSocketMessages) {
        window.pendingSocketMessages = [];
      }
      window.pendingSocketMessages.push({ event: eventName, args });
    }
  } catch (error) {
    logger.log(`Error emitting ${eventName}: ${error.message}`, 'error');
  }
}

/**
 * Constants for iframe access
 * These are available immediately
 */
export const selfContainer = document.getElementById('selfContainer');
export const selfContainerDocument = selfContainer?.contentWindow?.document;
export const oppContainer = document.getElementById('oppContainer');
export const oppContainerDocument = oppContainer?.contentWindow?.document;

/**
 * Safely get the self document with error handling
 * 
 * @returns {Document} Self container document
 * @throws {Error} If document is not available
 */
export function getSelfDocument() {
  if (!selfContainerDocument) {
    throw new Error('Self container document not available');
  }
  return selfContainerDocument;
}

/**
 * Safely get the opponent document with error handling
 * 
 * @returns {Document} Opponent container document
 * @throws {Error} If document is not available
 */
export function getOppDocument() {
  if (!oppContainerDocument) {
    throw new Error('Opponent container document not available');
  }
  return oppContainerDocument;
}

// Add a global build timestamp (replaced by build process)
const BUILD_TIMESTAMP = '__BUILD_TIMESTAMP__';