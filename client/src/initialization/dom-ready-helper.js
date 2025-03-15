/**
 * DOM Ready Helper
 * Provides utility functions to handle DOM readiness and element initialization
 * 
 * This module helps manage the challenges of working with elements that may not be 
 * immediately available in the DOM when scripts run.
 */

// Maximum number of retry attempts for finding elements
const MAX_RETRIES = 5;

/**
 * Waits for an element to be available in the DOM
 * @param {string} selector - CSS selector for the element
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise<Element|null>} - The DOM element or null if not found after retries
 */
export const waitForElement = (selector, maxRetries = MAX_RETRIES, delay = 500) => {
  let retries = 0;
  
  return new Promise((resolve) => {
    const check = () => {
      const element = document.querySelector(selector);
      
      if (element) {
        resolve(element);
        return;
      }
      
      retries++;
      if (retries >= maxRetries) {
        console.warn(`Element ${selector} not found after ${maxRetries} attempts`);
        resolve(null);
        return;
      }
      
      setTimeout(check, delay);
    };
    
    check();
  });
};

/**
 * Waits for multiple elements to be available in the DOM
 * @param {Array<string>} selectors - Array of CSS selectors
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delay - Delay between retries in milliseconds
 * @returns {Promise<Array<Element|null>>} - Array of found elements (or null for elements not found)
 */
export const waitForElements = (selectors, maxRetries = MAX_RETRIES, delay = 500) => {
  return Promise.all(
    selectors.map(selector => waitForElement(selector, maxRetries, delay))
  );
};

/**
 * Initializes an observer only when required elements are available
 * @param {Function} initFunction - The observer initialization function
 * @param {Array<string>} requiredSelectors - Array of required CSS selectors
 * @param {string} observerName - Name of the observer for logging
 * @param {number} maxRetries - Maximum retries for finding elements
 */
export const initializeWhenReady = async (initFunction, requiredSelectors, observerName, maxRetries = MAX_RETRIES) => {
  console.log(`Waiting for elements needed by ${observerName}...`);
  
  // Wait for all required elements
  const elements = await waitForElements(requiredSelectors, maxRetries);
  
  // Check if all elements were found
  if (elements.every(element => element !== null)) {
    console.log(`All elements for ${observerName} found, initializing...`);
    try {
      initFunction();
      console.log(`${observerName} initialized successfully`);
    } catch (error) {
      console.error(`Error initializing ${observerName}:`, error);
    }
  } else {
    console.warn(`Some elements for ${observerName} were not found, initialization skipped`);
    // Log which elements weren't found
    requiredSelectors.forEach((selector, index) => {
      if (elements[index] === null) {
        console.warn(`  Missing element: ${selector}`);
      }
    });
  }
};

/**
 * Checks if the DOM is fully loaded and ready
 * @param {Function} callback - Function to call when DOM is ready
 */
export const onDOMReady = (callback) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
  } else {
    // DOM already loaded, call immediately
    callback();
  }
};

/**
 * Safely gets an element from the DOM, returning null if not found
 * @param {string} selector - CSS selector for the element
 * @returns {Element|null} - The DOM element or null if not found
 */
export const safeQuerySelector = (selector) => {
  try {
    return document.querySelector(selector);
  } catch (error) {
    console.error(`Error querying selector "${selector}":`, error);
    return null;
  }
};

/**
 * Safely adds an event listener to a DOM element
 * @param {string|Element} elementOrSelector - DOM element or CSS selector
 * @param {string} eventType - Event type (e.g., 'click', 'mousedown')
 * @param {Function} handler - Event handler function
 * @returns {boolean} - True if successfully added, false otherwise
 */
export const safeAddEventListener = (elementOrSelector, eventType, handler) => {
  let element = elementOrSelector;
  
  // If selector string is provided, get the element
  if (typeof elementOrSelector === 'string') {
    element = safeQuerySelector(elementOrSelector);
  }
  
  if (element && typeof element.addEventListener === 'function') {
    try {
      element.addEventListener(eventType, handler);
      return true;
    } catch (error) {
      console.error(`Error adding ${eventType} event listener:`, error);
      return false;
    }
  }
  
  return false;
};

// Export default object for named imports
export default {
  waitForElement,
  waitForElements,
  initializeWhenReady,
  onDOMReady,
  safeQuerySelector,
  safeAddEventListener
};