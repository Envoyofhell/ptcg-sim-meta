// Import functions from their respective modules
import { initializeCardContextMenu } from './initialization/document-event-listeners/card-context-menu/initialize-card-context-menu.js';
import { initializeSidebox } from './initialization/document-event-listeners/sidebox/initialize-sidebox.js';
import { initializeTable } from './initialization/document-event-listeners/table/initialize-table.js';
import { initializeWindow } from './initialization/document-event-listeners/window/window.js';

// Main function to initialize all DOM event listeners
export const initializeDOMEventListeners = () => {
    try {
        initializeCardContextMenu();
        console.log('Card context menu initialized successfully.');
    } catch (error) {
        console.error("Failed to initialize card context menu:", error);
    }

    try {
        initializeSidebox();
        console.log('Sidebox initialized successfully.');
    } catch (error) {
        console.error("Failed to initialize sidebox:", error);
    }

    try {
        initializeTable();
        console.log('Table initialized successfully.');
    } catch (error) {
        console.error("Failed to initialize table:", error);
    }

    try {
        initializeWindow();
        console.log('Window initialized successfully.');
    } catch (error) {
        console.error("Failed to initialize window:", error);
    }
};

// Initialize DOM event listeners and handle retries if needed
const initializeWithRetry = () => {
    const maxRetries = 3;

    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        try {
            initializeDOMEventListeners();
            console.log('DOM event listeners initialized successfully on attempt', retryCount + 1);
            break; // Exit if successful
        } catch (error) {
            console.error(`Initialization attempt ${retryCount + 1} failed:`, error);
        }
    }
};

// Call the initialization function
initializeWithRetry();
