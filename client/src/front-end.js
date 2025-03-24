/**
 * PTCG-Sim-Meta Front-End Initialization
 * 
 * This file serves as the main entry point for the application.
 * It properly initializes the system state and all required components
 * in the correct order to prevent circular dependencies.
 * 
 * File: client/src/front-end.js
 * Version: 1.5.1.1
 */

// Import configuration
import { CONFIG, ENV, currentEnv } from './config/env-config.js';

// Import utilities and services
import { log } from './utils/logging.js';
import { socketService } from './services/socket-service.js';

// Import initialization modules
import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';
import * as globalVars from './initialization/global-variables/global-variables.js';

// Define global state objects
let systemState = null;
let socket = null;
let mouseClick = null;

/**
 * Safely initializes the system state with default values
 * to prevent errors during startup
 */
function ensureStateInitialization() {
  if (!systemState) {
    log('Creating default system state - this should not happen normally', 'warn', 'init');
    
    systemState = {
      version: '1.5.1.1',
      isTwoPlayer: false,
      roomId: '',
      isConnected: false,
      exportActionData: [],
      replayActionData: [],
      actionData: {
        self: [],
        opponent: [],
        spectator: []
      },
      selfCounter: 0,
      oppCounter: 0,
      isUndoInProgress: false,
      isReplay: false,
      isImporting: false,
      offlineMode: false
    };
  }
  
  // Validate critical arrays to prevent errors
  if (!Array.isArray(systemState.exportActionData)) {
    systemState.exportActionData = [];
  }
  
  if (!Array.isArray(systemState.replayActionData)) {
    systemState.replayActionData = [];
  }
  
  if (!systemState.actionData) {
    systemState.actionData = {
      self: [],
      opponent: [],
      spectator: []
    };
  }
  
  log('System state initialized', 'info', 'init');
}

/**
 * Initialize system state and other core components
 */
function initializeApp() {
  try {
    log('Starting initialization...', 'info', 'app');
    
    // Log environment information
    log(`Environment: ${currentEnv === ENV.PRODUCTION ? 'Production' : 
         currentEnv === ENV.DEVELOPMENT ? 'Development' : 'Local'}`, 'info', 'app');
    
    // Initialize system state from global variables
    systemState = globalVars.systemState || {};
    
    // Initialize mouse click state
    mouseClick = globalVars.mouseClick || {};
    
    // Set up socket connection
    socket = socketService;
    socket.initialize().catch(error => {
      log(`Socket initialization error: ${error.message}`, 'error', 'app');
    });
    
    // Ensure state has all required properties
    ensureStateInitialization();
    
    // Set up event listeners
    initializeSocketEventListeners();
    initializeDOMEventListeners();
    initializeMutationObservers();
    
    // Load any imported data
    loadImportData();
    
    log('Initialization complete', 'info', 'app');
    
    // Update UI connection status
    updateConnectionStatusUI();
    
    // Set up debug tools in development mode
    if (ENV.get('FEATURES.DEBUG_TOOLS', false)) {
      setupDebugTools();
    }
  } catch (error) {
    log(`Initialization failed: ${error.message}`, 'error', 'app');
    console.error('Stack trace:', error.stack);
    
    // Attempt recovery by ensuring state
    ensureStateInitialization();
    displayErrorNotification('Application initialization failed, but we recovered basic functionality. Some features may not work correctly.');
  }
}

/**
 * Set up debug tools for development environments
 */
function setupDebugTools() {
  window.__ptcg_debug = {
    getState: () => systemState,
    getSocket: () => socket,
    resetState: ensureStateInitialization,
    diagnostics: () => socket.getDiagnostics(),
    env: currentEnv,
    log: log
  };
  
  log('Debug tools initialized', 'debug', 'app');
}

/**
 * Update connection status UI
 */
function updateConnectionStatusUI() {
  if (!socket) return;
  
  let statusElement = document.getElementById('connectionStatus');
  
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.id = 'connectionStatus';
    statusElement.className = 'connection-status';
    
    const iconSpan = document.createElement('span');
    iconSpan.id = 'connectionIcon';
    
    const textSpan = document.createElement('span');
    textSpan.id = 'connectionText';
    
    statusElement.appendChild(iconSpan);
    statusElement.appendChild(textSpan);
    
    document.body.appendChild(statusElement);
  }
  
  const iconElement = document.getElementById('connectionIcon');
  const textElement = document.getElementById('connectionText');
  
  if (socket.connected) {
    statusElement.className = 'connection-status connected';
    iconElement.textContent = '⚡';
    textElement.textContent = 'Connected';
  } else if (socket.offlineMode) {
    statusElement.className = 'connection-status offline';
    iconElement.textContent = '💾';
    textElement.textContent = 'Offline Mode';
  } else {
    statusElement.className = 'connection-status disconnected';
    iconElement.textContent = '❌';
    textElement.textContent = 'Disconnected';
  }
}

/**
 * Display error notification to the user
 * @param {string} message - Error message to display
 */
function displayErrorNotification(message) {
  let notification = document.getElementById('error-notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'error-notification';
    notification.style.position = 'fixed';
    notification.style.bottom = '10px';
    notification.style.left = '10px';
    notification.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
    notification.style.color = 'white';
    notification.style.padding = '10px 15px';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    notification.style.zIndex = '9999';
    
    document.body.appendChild(notification);
  }
  
  notification.textContent = message;
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 10000);
}

/**
 * Register global error handlers
 */
function registerErrorHandlers() {
  // Handle uncaught exceptions
  window.addEventListener('error', (event) => {
    log(`Uncaught error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`, 'error', 'app');
    displayErrorNotification(`An error occurred: ${event.message}`);
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    log(`Unhandled promise rejection: ${event.reason}`, 'error', 'app');
    displayErrorNotification('An error occurred in background processing');
  });
}

// Start initialization when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    registerErrorHandlers();
    initializeApp();
  });
} else {
  // DOM already loaded, initialize immediately
  registerErrorHandlers();
  initializeApp();
}

// Export needed variables
export {
  systemState,
  socket,
  mouseClick,
  updateConnectionStatusUI
};

// Re-export elements from global variables
export {
  selfContainer,
  selfContainerDocument,
  oppContainer,
  oppContainerDocument
} from './initialization/global-variables/global-variables.js';