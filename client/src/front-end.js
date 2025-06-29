export * from './initialization/global-variables/global-variables.js'; // Initialize all globally accessible variables

import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';
import { initializeConnectionMonitor } from './setup/network/simple-connection-monitor.js';
import { initializeHoverPreview } from './setup/image-logic/hover-preview.js';

initializeSocketEventListeners(); // Initializes all event listeners for socket events
initializeDOMEventListeners(); // Initializes all event listeners for user's actions on html elements and the window
initializeMutationObservers(); // Initializes all mutation observers for user's actions on html elements
initializeConnectionMonitor(); // Initialize connection quality indicator for all users
initializeHoverPreview(); // Initialize hover preview system for card previews

loadImportData(); // get the importData (if there is any), and load the content.
