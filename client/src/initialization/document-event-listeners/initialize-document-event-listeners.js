import { initializeCardContextMenu } from './card-context-menu/initialize-card-context-menu.js';
import { initializeSidebox } from './sidebox/initialize-sidebox.js';
import { initializeTable } from './table/initialize-table.js';
import { initializeWindow } from './window/window.js';

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
