// Updated client/src/initialization/global-variables/global-variables.js
import { socketService } from '../../services/socket-service.js';
import { preloadImage } from '../../setup/general/preload-image.js';
import { LogService } from '../../services/log-service.js';

// Initialize logger
export const logger = new LogService();

/**
 * Creates and initializes the system state
 * @returns {Object} Initialized system state
 */
export function initializeSystemState() {
  logger.log('Initializing system state', 'info');
  
  // Create system state with default values
  const state = {
    // Version tracking
    version: '1.5.1.1',
    
    // Connection state
    isTwoPlayer: false,
    roomId: '',
    isConnected: false,
    isSpectator: false,
    
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
    
    // Counter tracking
    _selfCounter: 0,
    get selfCounter() { return this._selfCounter; },
    set selfCounter(value) {
      if (typeof value !== 'number') {
        logger.log(`Invalid selfCounter value: ${value}`, 'warn');
        return;
      }
      this._selfCounter = value;
    },
    
    // Username management
    usernames: {
      p1Self: 'Blue',
      p1Opp: 'Red',
      p2Self: '',
      p2Opp: '',
      spectator: ''
    },
    
    // Getting current username based on context
    get initiator() {
      return document.getElementById('selfContainer').classList.contains('self') ? 'self' : 'opp';
    },
    
    // Deck management
    selfDeckData: '',
    p1OppDeckData: '',
    p2OppDeckData: '',
    
    // Feature flags
    coachingMode: false,
    debugMode: false,
    
    // Card back management
    cardBackSrc: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
    p1OppCardBackSrc: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
    p2OppCardBackSrc: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
    
    // Background setting
    defaultBackground: `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.75)), 
      url('https://static0.gamerantimages.com/wordpress/wp-content/uploads/wm/2025/03/pokemon-legends-z-a-totodile-with-lumiose-bg.jpg')`
  };
  
  // Set initial background
  document.body.style.backgroundImage = state.defaultBackground;
  document.body.style.backgroundPosition = '-200px 0';
  
  // Preload default card back
  preloadImage(state.cardBackSrc);
  
  return state;
}

/**
 * Initializes the mouse click state
 * @param {Object} systemState - The system state
 * @returns {Object} Mouse click state
 */
export function initializeMouseClickState(systemState) {
  return {
    cardIndex: null,
    zoneId: null,
    cardUser: null,
    playContainer: null,
    playContainerParent: null,
    selectingCard: false,
    
    // Get the card object based on current selection
    get card() {
      try {
        if (!this.zoneId) return null;
        
        // Import getZone here to avoid circular dependencies
        const { getZone } = require('../../setup/zones/get-zone.js');
        const zone = getZone(this.cardUser, this.zoneId);
        
        return zone?.array[this.cardIndex] || null;
      } catch (error) {
        logger.log(`Error retrieving card: ${error.message}`, 'error');
        return null;
      }
    }
  };
}

/**
 * Safely makes a socket emission with error handling
 * @param {string} eventName - The event name
 * @param {...any} args - Arguments for the event
 */
export function safeSocketEmit(eventName, ...args) {
  try {
    socketService.emit(eventName, ...args);
  } catch (error) {
    logger.log(`Error emitting ${eventName}: ${error.message}`, 'error');
  }
}

/**
 * Initialize HTML Element References
 * These are available immediately and don't need to be in a function
 */
export const selfContainer = document.getElementById('selfContainer');
export const selfContainerDocument = selfContainer?.contentWindow?.document;
export const oppContainer = document.getElementById('oppContainer');
export const oppContainerDocument = oppContainer?.contentWindow?.document;

// Export element accessors with error handling
export function getSelfDocument() {
  if (!selfContainerDocument) {
    throw new Error('Self container document not available');
  }
  return selfContainerDocument;
}

export function getOppDocument() {
  if (!oppContainerDocument) {
    throw new Error('Opponent container document not available');
  }
  return oppContainerDocument;
}

// Export initialized socket for use throughout the application
export const socket = socketService;