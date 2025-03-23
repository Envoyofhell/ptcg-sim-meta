/**
 * PTCG-Sim-Meta Front-End Initialization
 * 
 * This file serves as the main entry point for the application.
 * It properly initializes the system state and all required components
 * in the correct order to prevent circular dependencies.
 * 
 * Version: 1.5.1.1
 */

// IMPORTANT: Initialize placeholders for global state to prevent errors
let systemState = null;
let socket = null;
let mouseClick = null;

/**
 * Safely initializes the system state with default values
 * to prevent errors during startup
 */
function ensureStateInitialization() {
  if (!systemState) {
    console.warn('[Initialization] Creating default system state - this should not happen normally');
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
  
  console.log('[App] System state initialized');
}

// Now we can safely import dependencies
import { socketService } from './services/socket-service.js';
import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';
import * as globalVars from './initialization/global-variables/global-variables.js';

// Initialize system state and other core components
function initializeApp() {
  try {
    console.log('[App] Starting initialization...');
    
    // Initialize system state from global variables
    systemState = globalVars.systemState || {};
    
    // Initialize mouse click state
    mouseClick = globalVars.mouseClick || {};
    
    // Set up socket connection
    socket = socketService;
    socket.initialize();
    
    // Ensure state has all required properties
    ensureStateInitialization();
    
    // Set up event listeners
    initializeSocketEventListeners();
    initializeDOMEventListeners();
    initializeMutationObservers();
    
    // Load any imported data
    loadImportData();
    
    console.log('[App] Initialization complete');
    
    // Update UI connection status
    updateConnectionStatusUI();
    
    // Set up debug tools in development mode
    if (window.location.hostname.includes('localhost') || 
        window.location.hostname.includes('dev') || 
        window.location.search.includes('debug=true')) {
      window.__ptcg_debug = {
        getState: () => systemState,
        getSocket: () => socket,
        resetState: ensureStateInitialization,
        diagnostics: () => socket.getDiagnostics()
      };
    }
  } catch (error) {
    console.error('[App] Initialization failed:', error);
    
    // Attempt recovery by ensuring state
    ensureStateInitialization();
    displayErrorNotification('Application initialization failed, but we recovered basic functionality. Some features may not work correctly.');
  }
}

// Display connection status in UI
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

// Display error notification
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

// Start initialization when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded, initialize immediately
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