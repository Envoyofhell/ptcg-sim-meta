/**
 * Hand Observer Module
 * Monitors changes to hand elements and adjusts their alignment
 */
import { adjustAlignment } from '../../setup/sizing/adjust-alignment.js';
import { logWarning, logInfo, logError } from '../../error-tracking.js';

// Maximum retries for finding elements
const MAX_RETRIES = 5;

/**
 * Initializes the hand observer
 */
export const initializeHandObserver = () => {
  let retryCount = 0;
  
  const initialize = () => {
    // Safely get elements
    const handElement = document.querySelector('#selfContainer #hand');
    const oppHandElement = document.querySelector('#oppContainer #hand');

    // Check if elements exist
    if (!handElement || !oppHandElement) {
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        logWarning('Hand observer: Required elements not found. Will retry later.');
        setTimeout(initialize, 500);
      } else {
        logWarning(`Hand observer initialization stopped after ${MAX_RETRIES} attempts`);
      }
      return;
    }

    try {
      const handObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            [handElement, oppHandElement].forEach(adjustAlignment);
          }
        });
      });

      // Options for the observer (which mutations to observe)
      const handConfig = { childList: true };

      // Start observing the target nodes for configured mutations
      [handElement, oppHandElement].forEach((target) => {
        handObserver.observe(target, handConfig);
      });
      
      logInfo('Hand observer initialized successfully');
    } catch (error) {
      logError('Error initializing hand observer:', error);
    }
  };
  
  // Start initialization
  initialize();
};