import { initializeBoardObserver } from './board-observer.js';
import { initializeHandObserver } from './hand-observer.js';
import { initializePrizesObserver } from './prizes-observer.js';
import { initializeStadiumObserver } from './stadium-observer.js';

/**
 * Initialize all mutation observers
 * This function ensures observers are only initialized when the DOM is ready
 */
export const initializeMutationObservers = () => {
  // Function to check if the DOM is ready for observer initialization
  const isDomReady = () => {
    // Check for key elements that observers will monitor
    const selfContainer = document.getElementById('selfContainer');
    const oppContainer = document.getElementById('oppContainer');
    const stadium = document.getElementById('stadium');
    
    return selfContainer && oppContainer && stadium;
  };

  // Safely initialize all observers with error handling
  const safelyInitialize = () => {
    try {
      console.log('Initializing mutation observers...');
      
      // Initialize each observer with error handling
      const observers = [
        { name: 'Board Observer', fn: initializeBoardObserver },
        { name: 'Hand Observer', fn: initializeHandObserver },
        { name: 'Prizes Observer', fn: initializePrizesObserver },
        { name: 'Stadium Observer', fn: initializeStadiumObserver }
      ];
      
      observers.forEach(({ name, fn }) => {
        try {
          fn();
          console.log(`${name} initialized successfully`);
        } catch (error) {
          console.error(`Error initializing ${name}:`, error);
        }
      });
    } catch (error) {
      console.error('Failed to initialize mutation observers:', error);
    }
  };

  // If DOM is ready, initialize immediately
  if (isDomReady()) {
    safelyInitialize();
  } else {
    // If not ready, wait for DOM to be ready
    console.log('DOM not ready for observers, will initialize when ready');
    
    // Try again soon, using both the load event and a timeout as fallbacks
    window.addEventListener('DOMContentLoaded', () => {
      if (isDomReady()) safelyInitialize();
    });
    
    window.addEventListener('load', () => {
      if (isDomReady()) safelyInitialize();
    });
    
    // Final fallback with a timeout
    setTimeout(() => {
      if (isDomReady()) safelyInitialize();
    }, 1000);
  }
};