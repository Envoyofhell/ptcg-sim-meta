import { initializeCardContextMenu } from './card-context-menu/initialize-card-context-menu.js';
import { initializeSidebox } from './sidebox/initialize-sidebox.js';
import { initializeTable } from './table/initialize-table.js';
import { initializeWindow } from './window/window.js';

let domEventListenersInitialized = false;

export const initializeDOMEventListeners = () => {
  if (domEventListenersInitialized) {
    return; // Exit if already initialized
  }

  initializeCardContextMenu();
  initializeSidebox();
  initializeTable();
  initializeWindow();

  domEventListenersInitialized = true; // Mark as initialized
};
