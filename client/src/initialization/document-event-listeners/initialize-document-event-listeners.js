import { initializeCardContextMenu } from './card-context-menu/initialize-card-context-menu.js';
import { initializeSidebox } from './sidebox/initialize-sidebox.js';
import { initializeTable } from './table/initialize-table.js';
import { initializeWindow } from './window/window.js';
import { waitForElement } from '../dom-ready-helper.js';

/**
 * Initialize all DOM event listeners with proper error handling
 */
export const initializeDOMEventListeners = async () => {
  console.log('Initializing DOM event listeners...');
  
  // Create an array of initialization functions and their corresponding log messages
  const initializers = [
    { fn: initializeCardContextMenu, name: 'Card context menu' },
    { fn: initializeSidebox, name: 'Sidebox' },
    { fn: initializeTable, name: 'Table' },
    { fn: initializeWindow, name: 'Window' }
  ];

  // Ensure key DOM elements exist before proceeding
  // These are the most critical elements needed for initialization
  const criticalElements = [
    '#selfContainer', 
    '#oppContainer', 
    '#selfResizer', 
    '#oppResizer'
  ];
  
  // Wait for critical elements with a short timeout
  const elements = await Promise.all(
    criticalElements.map(selector => waitForElement(selector, 3))
  );
  
  // Check if all critical elements were found
  if (!elements.every(el => el !== null)) {
    console.error('Critical DOM elements not found, initialization may fail');
    
    // Log which elements are missing
    criticalElements.forEach((selector, index) => {
      if (!elements[index]) {
        console.error(`Missing critical element: ${selector}`);
      }
    });
  }

  // Loop through each initializer and execute it with error handling
  for (const { fn, name } of initializers) {
    try {
      fn();
      console.log(`${name} initialized successfully.`);
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
      
      // Continue with other initializers despite errors
      // This allows the app to partially function even if some components fail
    }
  }
  
  console.log('DOM event listeners initialization completed');
};