/**
 * Table Resizer Initialization
 * Sets up event listeners for container resizers
 * 
 * @module TableResizerInitialization
 */
import createResizer from '../../../setup/sizing/resizer.js';
import { selfContainer, oppContainer } from '../../../front-end.js';

/**
 * Initialize resizer event listeners
 * @throws {Error} If required DOM elements are not found
 */
export const initializeResizers = () => {
  try {
    // Safely retrieve resizer elements
    const selfResizer = document.getElementById('selfResizer');
    const oppResizer = document.getElementById('oppResizer');

    // Validate element existence
    if (!selfResizer || !oppResizer) {
      console.error('Resizer elements not found', {
        selfResizer: !!selfResizer,
        oppResizer: !!oppResizer
      });
      return;
    }

    // Create the resizer functionality with the containers
    const { selfHandleMouseDown, oppHandleMouseDown } = createResizer({
      selfContainer,
      oppContainer
    });

    // Attach event listeners
    selfResizer.addEventListener('mousedown', selfHandleMouseDown);
    oppResizer.addEventListener('mousedown', oppHandleMouseDown);
    
    console.log('Resizer event listeners initialized successfully');
  } catch (error) {
    console.error('Failed to initialize resizers:', error);
  }
};

export default initializeResizers;