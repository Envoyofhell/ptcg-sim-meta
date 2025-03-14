/**
 * Front-end Initialization Module for PTCG Simulator
 * Manages application initialization, event listeners, and core setup
 * 
 * @module FrontEnd
 * @description Handles application bootstrap and core initialization
 */
// Import global variables explicitly
import { 
  socket, 
  systemState, 
  mouseClick, 
  version 
} from './initialization/global-variables/global-variables.js';

// Import initialization modules directly
import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';

// Import resizer module with a fixed path
import { createResizer } from './setup/sizing/resizer.js';

// Create a logger for better error tracking and debugging
const logger = {
  error: (message, details = {}) => {
    console.error(`[Front-end Error] ${message}`, details);
  },
  warn: (message, details = {}) => {
    console.warn(`[Front-end Warning] ${message}`, details);
  },
  info: (message, details = {}) => {
    console.info(`[Front-end Info] ${message}`, details);
  }
};

// Container references - use direct DOM selection
const selfContainer = document.getElementById('selfContainer');
const oppContainer = document.getElementById('oppContainer');
const selfContainerDocument = selfContainer;
const oppContainerDocument = oppContainer;

// Log initialization start
logger.info('Front-end.js is loading');

// Initialize resizer with container references
const resizerParams = {
  selfContainer,
  oppContainer,
  selfContainerDocument,
  oppContainerDocument,
  getInitiator: () => systemState.initiator
};

// Create resizer instance
const resizer = createResizer(resizerParams);

// Extract resize handlers from the resizer instance
const {
  selfHandleMouseDown,
  oppHandleMouseDown,
  flippedSelfHandleMouseDown,
  flippedOppHandleMouseDown
} = resizer || {};

// Initialization with retry capability
const initializeWithRetry = (initFunction, functionName, maxRetries = 3) => {
  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      initFunction();
      logger.info(`${functionName} initialized successfully on attempt ${retryCount + 1}`);
      return true;
    } catch (error) {
      logger.error(`${functionName} initialization attempt ${retryCount + 1} failed`, { error });
      
      // If on last attempt, rethrow to be caught by main error handler
      if (retryCount === maxRetries - 1) {
        throw error;
      }
    }
  }
  return false;
};

// Main initialization function
const initializeFrontEnd = () => {
  try {
    // Sequential initialization with retries - following original order
    initializeWithRetry(initializeSocketEventListeners, 'Socket event listeners');
    initializeWithRetry(initializeDOMEventListeners, 'DOM event listeners');
    initializeWithRetry(initializeMutationObservers, 'Mutation observers');
    initializeWithRetry(loadImportData, 'Import data loading');

    logger.info('Application initialized successfully');
    return true;
  } catch (error) {
    logger.error('Front-end initialization failed', { error });
    return false;
  }
};

// Execute initialization
initializeFrontEnd();

// Optional global error handler
window.addEventListener('error', (event) => {
  logger.error('Unhandled front-end error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

// Export all necessary variables and functions
export { 
  // Global variables
  socket,
  systemState,
  mouseClick,
  version,
  
  // Container references
  selfContainer,
  oppContainer,
  selfContainerDocument,
  oppContainerDocument,
  
  // Resizer functions
  selfHandleMouseDown,
  oppHandleMouseDown,
  flippedSelfHandleMouseDown,
  flippedOppHandleMouseDown
};