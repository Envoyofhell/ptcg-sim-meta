/**
 * Prizes Observer Module
 * Monitors prize cards and adjusts their appearance based on count
 */
import { logWarning, logInfo, logError } from '../../error-tracking.js';

// Maximum retries for finding elements
const MAX_RETRIES = 5;

/**
 * Initializes the prizes observer
 */
export const initializePrizesObserver = () => {
  let retryCount = 0;
  
  const initialize = () => {
    // Safely get elements
    const prizesElement = document.querySelector('#selfContainer #prizes');
    const oppPrizesElement = document.querySelector('#oppContainer #prizes');

    // Check if elements exist
    if (!prizesElement || !oppPrizesElement) {
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        logWarning('Prizes observer: Required elements not found. Will retry later.');
        setTimeout(initialize, 500);
      } else {
        logWarning(`Prizes observer initialization stopped after ${MAX_RETRIES} attempts`);
      }
      return;
    }

    try {
      // Function to adjust image size based on the number of images
      const adjustImageSize = (element) => {
        if (!element) return;
        
        const images = element.getElementsByTagName('img');
        if (!images || images.length === 0) return;
        
        const numImages = images.length;
        const classList = numImages <= 6 ? 'prizes-normal-size' : 'prizes-small-size';

        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          image.classList.remove('prizes-normal-size', 'prizes-small-size');
          image.classList.add(classList);
        }
      };

      // Initial adjustment of images
      adjustImageSize(prizesElement);
      adjustImageSize(oppPrizesElement);

      // Observer configuration
      const observerConfig = { childList: true, subtree: true };

      // Callback function for the Mutation Observer
      const mutationCallback = (mutationsList) => {
        for (let i = 0; i < mutationsList.length; i++) {
          const mutation = mutationsList[i];
          if (mutation.type === 'childList') {
            // Child nodes have been added or removed, adjust image size
            adjustImageSize(mutation.target);
          }
        }
      };

      // Create a Mutation Observer with the specified callback and configuration
      const observer = new MutationObserver(mutationCallback);

      // Start observing the target nodes for configured mutations
      observer.observe(prizesElement, observerConfig);
      observer.observe(oppPrizesElement, observerConfig);
      
      logInfo('Prizes observer initialized successfully');
    } catch (error) {
      logError('Error initializing prizes observer:', error);
    }
  };
  
  // Start initialization
  initialize();
};