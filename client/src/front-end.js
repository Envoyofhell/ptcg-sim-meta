// Import everything from global-variables.js as named exports
export * from './initialization/global-variables/global-variables.js'; 

// Import individual functions from other modules
import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';

// Call the initialization functions to set up event listeners
try {
    initializeSocketEventListeners(); // Initializes all event listeners for socket events
    initializeDOMEventListeners(); // Initializes all event listeners for user's actions on HTML elements and the window
    initializeMutationObservers(); // Initializes all mutation observers for user's actions on HTML elements
    loadImportData(); // Fetch and load any importData if available
} catch (error) {
    console.error("Initialization failed:", error);
}
