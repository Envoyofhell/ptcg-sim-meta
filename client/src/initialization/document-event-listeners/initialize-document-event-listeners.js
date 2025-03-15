/**
 * Document Event Listeners Initialization Module
 * Coordinates initialization of all DOM event handlers
 */
import { initializeCardContextMenu } from './card-context-menu/initialize-card-context-menu.js';
import { initializeSidebox } from './sidebox/initialize-sidebox.js';
import { initializeTable } from './table/initialize-table.js';
import { initializeWindow } from './window/window.js';

/**
 * Initialize all DOM event listeners with proper error handling
 * This is the main entry point for setting up all DOM-related event handlers
 */
export const initializeDOMEventListeners = async () => {
  console.log('Initializing DOM event listeners...');
  
  // Create an array of initialization functions and their corresponding names
  const initializers = [
    { fn: initializeCardContextMenu, name: 'Card context menu' },
    { fn: initializeSidebox, name: 'Sidebox' },
    { fn: initializeTable, name: 'Table' },
    { fn: initializeWindow, name: 'Window' }
  ];

  // Ensure key DOM elements exist before proceeding
  // Check for critical containers that many components depend on
  const criticalElements = [
    document.getElementById('selfContainer'), 
    document.getElementById('oppContainer'), 
    document.getElementById('selfResizer'), 
    document.getElementById('oppResizer')
  ];
  
  // Log warnings for any missing critical elements
  const missingElements = [];
  ['selfContainer', 'oppContainer', 'selfResizer', 'oppResizer'].forEach((id, index) => {
    if (!criticalElements[index]) {
      missingElements.push(id);
    }
  });
  
  if (missingElements.length > 0) {
    console.warn('Critical DOM elements not found:', missingElements.join(', '));
    console.warn('Some initialization may fail due to missing elements');
  }

  // Loop through each initializer and execute it with error handling
  for (const { fn, name } of initializers) {
    try {
      fn();
      console.log(`${name} initialized successfully.`);
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
      
      // Continue with other initializers despite errors
      // This allows partial functionality even when some components fail
    }
  }
  
  console.log('DOM event listeners initialization completed');
};