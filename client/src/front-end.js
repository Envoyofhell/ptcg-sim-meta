// Import individual functions from the respective modules
import { initializeCardContextMenu } from './initialization/document-event-listeners/card-context-menu/initialize-card-context-menu.js';
import { initializeSidebox } from './initialization/document-event-listeners/sidebox/initialize-sidebox.js';
import { initializeTable } from './initialization/document-event-listeners/table/initialize-table.js';
import { initializeWindow } from './initialization/document-event-listeners/window/window.js';

// To keep your logic here too
export const initializeDOMEventListeners = () => {
  try {
    initializeCardContextMenu();
    initializeSidebox();
    initializeTable();
    initializeWindow();
  } catch (error) {
    console.error("Error initializing DOM event listeners:", error);
  }
};

// Call the initialization function for DOM event listeners
try {
    initializeDOMEventListeners(); // Now invoke it
} catch (error) {
    console.error("Initialization failed:", error);
}
