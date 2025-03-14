// front-end.js
import { initializeCardContextMenu } from './initialization/document-event-listeners/card-context-menu/initialize-card-context-menu.js';
import { initializeSidebox } from './initialization/document-event-listeners/sidebox/initialize-sidebox.js';
import { initializeTable } from './initialization/document-event-listeners/table/initialize-table.js';
import { initializeWindow } from './initialization/document-event-listeners/window/window.js';

import { 
    socket, 
    systemState, 
    mouseClick, 
    version 
} from './initialization/global-variables/global-variables.js';

// Resizer function imports
import {
    oppHandleMouseDown,
    selfHandleMouseDown,
    flippedOppHandleMouseDown,
    flippedSelfHandleMouseDown
} from '../setup/sizing/resizer.js';

// Container references
const selfContainerDocument = document.getElementById('selfContainer');
const oppContainerDocument = document.getElementById('oppContainer');

// Logging imports
console.log('Front-end.js is loading');
console.log('Imports:', {
    initializeCardContextMenu: typeof initializeCardContextMenu,
    initializeSidebox: typeof initializeSidebox,
    initializeTable: typeof initializeTable,
    initializeWindow: typeof initializeWindow,
});

// Main function to initialize all DOM event listeners
const initializeDOMEventListeners = () => {
    try {
        initializeCardContextMenu(); // Initialize card context menu
        console.log('Card context menu initialized successfully.');
    } catch (error) {
        console.error('Failed to initialize card context menu:', error);
    }

    try {
        initializeSidebox(); // Initialize sidebox
        console.log('Sidebox initialized successfully.');
    } catch (error) {
        console.error('Failed to initialize sidebox:', error);
    }

    try {
        initializeTable(); // Initialize table setup
        console.log('Table initialized successfully.');
    } catch (error) {
        console.error('Failed to initialize table:', error);
    }

    try {
        initializeWindow(); // Initialize window-specific features
        console.log('Window initialized successfully.');
    } catch (error) {
        console.error('Failed to initialize window:', error);
    }
};

// Function to initialize event listeners with retries if necessary
const initializeWithRetry = () => {
    const maxRetries = 3;

    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        try {
            initializeDOMEventListeners();
            console.log(
                'DOM event listeners initialized successfully on attempt',
                retryCount + 1
            );
            break; // Exit if successful
        } catch (error) {
            console.error(`Initialization attempt ${retryCount + 1} failed:`, error);
        }
    }
};

// Call the function to initialize the event listeners
initializeWithRetry();

// Export necessary modules and references
export { 
    socket,
    systemState,
    mouseClick,
    version,
    
    // Container documents
    selfContainerDocument,
    oppContainerDocument,
    
    // Rename export
    oppContainerDocument as oppContainer,
    selfContainerDocument as selfContainer,
    
    initializeCardContextMenu,
    initializeSidebox,
    initializeTable,
    initializeWindow,

    // Resizer functions
    oppHandleMouseDown,
    selfHandleMouseDown,
    flippedOppHandleMouseDown,
    flippedSelfHandleMouseDown
};