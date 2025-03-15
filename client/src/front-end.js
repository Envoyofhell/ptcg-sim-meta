/**
 * Front-end.js - Main entry point for the PTCG Simulator application
 * Handles initialization of all application components and exports global variables
 */

// Export everything from global-variables for use throughout the application
export * from './initialization/global-variables/global-variables.js';

// Import the key services and initialization functions
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';
import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';

// Import any other modules that need to be accessible globally
import { getZone } from './setup/zones/get-zone.js';
import { systemState, selfContainer, oppContainer, socket } from './initialization/global-variables/global-variables.js';
import createResizer from './setup/sizing/resizer.js';

// Logger for frontend events
const logger = {
  info: (message, details = {}) => {
    console.log('[Front-end Info]', message, details);
  },
  warn: (message, details = {}) => {
    console.warn('[Front-end Warning]', message, details);
  },
  error: (message, details = {}) => {
    console.error('[Front-end Error]', message, details);
  }
};

/**
 * Checks if the DOM is fully loaded and ready
 * @param {Function} callback - Function to call when DOM is ready
 */
const onDOMReady = (callback) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    callback();
  }
};

// Initialize components with retry mechanism
const initializeWithRetry = (initFn, name, maxRetries = 3) => {
  let attempt = 1;
  
  const tryInit = () => {
    try {
      initFn();
      logger.info(`${name} initialized successfully on attempt ${attempt}`, { attempt });
      return true;
    } catch (error) {
      logger.error(`${name} initialization attempt ${attempt} failed`, error);
      
      if (attempt < maxRetries) {
        attempt++;
        setTimeout(tryInit, 500 * attempt); // Increasing delay between retries
        return false;
      } else {
        logger.error(`${name} initialization failed after ${maxRetries} attempts`);
        return false;
      }
    }
  };
  
  return tryInit();
};

// Create resizer instance for the containers
// Initialize this early to make it available for other modules
const {
  selfHandleMouseDown,
  oppHandleMouseDown
} = createResizer({
  selfContainer,
  oppContainer
});

// Export the mouse handlers for other modules
export { selfHandleMouseDown, oppHandleMouseDown };

// Initialize all application components in correct sequence
const initializeFrontEnd = () => {
  try {
    logger.info('Front-end.js is loading');
    
    // Step 1: Initialize socket event listeners
    initializeWithRetry(initializeSocketEventListeners, 'Socket event listeners');
    
    // Step 2: Initialize DOM event listeners
    initializeWithRetry(initializeDOMEventListeners, 'DOM event listeners');
    
    // Step 3: Initialize mutation observers
    initializeWithRetry(initializeMutationObservers, 'Mutation observers');
    
    // Step 4: Load import data if available
    // This is wrapped in a function to allow retries
    const tryLoadImportData = () => {
      try {
        loadImportData();
        logger.info('Import data loading completed');
        return true;
      } catch (error) {
        logger.error('Import data loading failed', error);
        return false;
      }
    };
    
    // Try loading import data with retries
    for (let i = 1; i <= 3; i++) {
      if (tryLoadImportData()) break;
      logger.error(`Import data loading initialization attempt ${i} failed`);
      
      if (i === 3) {
        logger.warn('Import data initialization failed, but application may still function');
      }
    }
    
    // Initialize resizers after DOM is fully loaded
    const selfResizer = document.getElementById('selfResizer');
    const oppResizer = document.getElementById('oppResizer');
    
    if (selfResizer && oppResizer) {
      selfResizer.addEventListener('mousedown', selfHandleMouseDown);
      oppResizer.addEventListener('mousedown', oppHandleMouseDown);
      logger.info('Resizers initialized successfully');
    } else {
      logger.warn('Resizer elements not found, resizer functionality disabled');
    }
    
    // Log successful initialization
    logger.info('Front-end initialization completed successfully');
    
  } catch (error) {
    logger.error('Front-end initialization failed', error);
  }
};

// Define global objects for other modules to use
export const mouseClick = {
  cardIndex: '',
  zoneId: '',
  cardUser: '',
  playContainer: '',
  playContainerParent: '',
  selectingCard: false,
  isActiveZone: '',
  get card() {
    if (this.zoneId) {
      return getZone(this.cardUser, this.zoneId).array[this.cardIndex];
    }
    return null;
  },
};

// Start initialization when document is ready
onDOMReady(initializeFrontEnd);