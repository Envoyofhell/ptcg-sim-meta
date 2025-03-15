/**
 * Stadium Observer Module
 * Monitors stadium-related elements and adjusts z-index as needed
 * 
 * This observer watches for visibility changes in game zones and adjusts
 * the z-index of the stadium element accordingly to prevent visual conflicts.
 */
import { logWarning, logInfo } from '../../error-tracking.js';

// Maximum number of retry attempts to find required elements
const MAX_RETRIES = 5;

/**
 * Initialize the stadium observer
 * Monitors zone displays to adjust stadium element z-index
 */
export const initializeStadiumObserver = () => {
  // Track retry attempts
  let retryCount = 0;
  
  // Main initialization function with retry capability
  const initialize = () => {
    // List of zone IDs to monitor
    const zoneIds = ['lostZone', 'deck', 'discard', 'attachedCards', 'viewCards'];
    
    // Use document.querySelector to find elements in both containers
    const selfElements = zoneIds.map((zoneId) =>
      document.querySelector(`#selfContainer #${zoneId}`)
    ).filter(el => el !== null); // Remove any null elements
    
    const oppElements = zoneIds.map((zoneId) =>
      document.querySelector(`#oppContainer #${zoneId}`)
    ).filter(el => el !== null); // Remove any null elements
    
    // Combine all elements into a single array
    const elements = [...selfElements, ...oppElements];
    
    // Get the stadium and button container elements
    const stadiumElement = document.getElementById('stadium');
    const boardButtonContainer = document.getElementById('boardButtonContainer');
    
    // Check if we have enough elements to proceed
    if (elements.length === 0 || !stadiumElement || !boardButtonContainer) {
      // Increment retry counter
      retryCount++;
      
      // Retry if under the maximum limit
      if (retryCount < MAX_RETRIES) {
        // Use rate-limited warning
        logWarning('Stadium observer: Not all required elements found. Will retry later.');
        setTimeout(initialize, 500);
      } else {
        // Final warning - we're giving up
        logWarning(`Stadium observer initialization stopped after ${MAX_RETRIES} attempts`);
      }
      return;
    }
    
    // Log successful element detection
    logInfo('Stadium observer: All required elements found, initializing.');
    
    /**
     * Function to check the display of the elements and update the z-index
     * This is called both initially and whenever observed elements change
     */
    const checkDisplayAndUpdateZIndex = () => {
      // Check if any monitored element is displayed
      let anyDisplayed = false;
      
      for (let i = 0; i < elements.length; i++) {
        if (elements[i].style.display === 'block') {
          anyDisplayed = true;
          break;
        }
      }
      
      // Set z-index based on whether any elements are displayed
      // -1 puts the stadium behind other elements when zones are displayed
      // 0 brings it forward when no zones are displayed
      stadiumElement.style.zIndex = anyDisplayed ? '-1' : '0';
      boardButtonContainer.style.zIndex = anyDisplayed ? '-1' : '0';
    };
    
    // Create a MutationObserver instance to watch for style changes
    const observer = new MutationObserver(checkDisplayAndUpdateZIndex);
    
    // Configure what changes to observe (only style attribute changes)
    const config = { attributes: true, attributeFilter: ['style'] };
    
    // Start observing each element for style changes
    elements.forEach((element) => {
      observer.observe(element, config);
    });
    
    // Run initial check
    checkDisplayAndUpdateZIndex();
    
    // Log successful initialization
    logInfo('Stadium observer initialized successfully');
  };
  
  // Start the initialization process
  initialize();
};