// Modified client/src/front-end.js
// Fix initialization order to prevent circular dependencies

// Move variable declarations to the top
let systemState = null;

// Ensure all state is properly initialized for offline mode
function ensureStateInitialization() {
  if (!systemState) {
    console.error('System state not yet initialized, creating default state');
    systemState = {
      exportActionData: [],
      replayActionData: [],
      actionData: {
        self: [],
        opponent: [],
        spectator: []
      }
    };
  }
  
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

// Import in correct order, after variable declaration
import { initializeSystemState } from './initialization/global-variables/global-variables.js';
import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';

// Initialize system state first, then assign to our local variable
systemState = initializeSystemState();

// Only after state is initialized, run other initialization steps
ensureStateInitialization();
initializeSocketEventListeners();
initializeDOMEventListeners();
initializeMutationObservers();
loadImportData();

// Re-export necessary variables
export * from './initialization/global-variables/global-variables.js';