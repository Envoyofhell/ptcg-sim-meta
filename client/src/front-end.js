// Import individual functions from the respective modules
import { initializeCardContextMenu } from './initialization/document-event-listeners/card-context-menu/initialize-card-context-menu.js';
import { initializeSidebox } from './initialization/document-event-listeners/sidebox/initialize-sidebox.js';
import { initializeTable } from './initialization/document-event-listeners/table/initialize-table.js';
import { initializeWindow } from './initialization/document-event-listeners/window/window.js';

// Initialize DOM event listeners
const initializeDOMEventListeners = () => {
    try {
        initializeCardContextMenu(); // Initialize card context menu
        console.log('Card context menu initialized successfully.');
    } catch (error) {
        console.error("Failed to initialize card context menu:", error);
    }

    try {
        initializeSidebox(); // Initialize sidebox
        console.log('Sidebox initialized successfully.');
    } catch (error) {
        console.error("Failed to initialize sidebox:", error);
    }

    try {
        initializeTable(); // Initialize table setup
        console.log('Table initialized successfully.');
    } catch (error) {
        console.error("Failed to initialize table:", error);
    }

    try {
        initializeWindow(); // Initialize window-specific features
        console.log('Window initialized successfully.');
    } catch (error) {
        console.error("Failed to initialize window:", error);
    }
};

// Function to initialize with retries
const initializeWithRetry = () => {
    const maxRetries = 3;

    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        try {
            // Call the DOM event initialization
            initializeDOMEventListeners();
            console.log('DOM event listeners initialized successfully on attempt', retryCount + 1);
            break; // Exit if successful
        } catch (error) {
            console.error(`Initialization attempt ${retryCount + 1} failed:`, error);
        }
    }
};

// Call the function to initialize the event listeners
initializeWithRetry();
