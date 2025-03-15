/**
 * Board Observer Module
 * Handles board element scrolling when content changes
 */
import { logWarning, logInfo, logError } from '../../error-tracking.js';

// Maximum retries for finding elements
const MAX_RETRIES = 5;

/**
 * Scrolls an element to the bottom
 * @param {HTMLElement} element - The element to scroll
 */
const scrollToBottom = (element) => {
  if (element) {
    element.scrollTop = element.scrollHeight;
  }
};

/**
 * Processes mutations to handle scrolling when content changes
 * @param {HTMLElement} element - The element to scroll
 * @param {MutationRecord[]} mutations - The observed mutations
 */
const handleMutations = (element, mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      scrollToBottom(element);
    }
  });
};

/**
 * Initializes the board observer
 */
export const initializeBoardObserver = () => {
  let retryCount = 0;
  
  const initialize = () => {
    // Get board elements
    const boardElement = document.querySelector('#selfContainer #board');
    const oppBoardElement = document.querySelector('#oppContainer #board');

    // Check if elements exist
    if (!boardElement || !oppBoardElement) {
      retryCount++;
      
      if (retryCount < MAX_RETRIES) {
        logWarning('Board observer: Required elements not found. Will retry later.');
        setTimeout(initialize, 500);
      } else {
        logWarning(`Board observer initialization stopped after ${MAX_RETRIES} attempts`);
      }
      return;
    }

    try {
      // Create MutationObserver instances for both elements
      const boardObserver = new MutationObserver((mutations) =>
        handleMutations(boardElement, mutations)
      );
      const oppBoardObserver = new MutationObserver((mutations) =>
        handleMutations(oppBoardElement, mutations)
      );

      // Configure the observers to watch for changes to child nodes
      const observerConfig = { childList: true };

      // Start observing the target nodes
      boardObserver.observe(boardElement, observerConfig);
      oppBoardObserver.observe(oppBoardElement, observerConfig);
      
      logInfo('Board observer initialized successfully');
    } catch (error) {
      logError('Error initializing board observer:', error);
    }
  };
  
  // Start initialization
  initialize();
};