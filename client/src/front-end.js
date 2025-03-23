// File: client/src/front-end.js

// Add after all import statements
export * from './initialization/global-variables/global-variables.js'; // Initialize all globally accessible variables

import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';

// Ensure all state is properly initialized for offline mode
function ensureStateInitialization() {
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

// Initialize everything
ensureStateInitialization();
initializeSocketEventListeners(); // Initializes all event listeners for socket events
initializeDOMEventListeners(); // Initializes all event listeners for user's actions on html elements and the window
initializeMutationObservers(); // Initializes all mutation observers for user's actions on html elements
loadImportData(); // get the importData (if there is any), and load the content.