// Import individual functions from the respective modules
import { initializeCardContextMenu } from './initialization/document-event-listeners/card-context-menu/initialize-card-context-menu.js';
import { initializeSidebox } from './initialization/document-event-listeners/sidebox/initialize-sidebox.js';
import { initializeTable } from './initialization/document-event-listeners/table/initialize-table.js';
import { initializeWindow } from './initialization/document-event-listeners/window/window.js';

// Initialize DOM event listeners with redundancy
export const initializeDOMEventListeners = () => {
    try {
        initializeCardContextMenu(); // Initialize card context menu
        initializeSidebox();          // Initialize sidebox
        initializeTable();            // Initialize table setup
        initializeWindow();           // Initialize window-specific features
    } catch (error) {
        console.error("Error initializing DOM event listeners:", error);
        // Optional: Retry logic or alternative handling can be added here.
    }
};

// Function to initialize with retries
const initializeWithRetry = () => {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
        try {
            // Check if the function exists before invoking it
            if (typeof initializeDOMEventListeners === 'function') {
                initializeDOMEventListeners();
                break; // If successful, exit the loop
            } else {
                console.error("initializeDOMEventListeners is not defined.");
                break; // Exit if function isn't defined
            }
        } catch (error) {
            console.error(`Initialization failed (attempt ${retryCount + 1}):`, error);
            retryCount++;
        }
    }
    if (retryCount === maxRetries) {
        console.error("Max retries reached. Initialization failed.");
    }
};

// Call the function to init
