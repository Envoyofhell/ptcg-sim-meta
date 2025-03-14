/**
 * Table Resizer Initialization
 * Sets up event listeners for container resizers
 * 
 * @module TableResizerInitialization
 */
import { 
  selfHandleMouseDown, 
  oppHandleMouseDown 
} from '../../../front-end.js';

/**
 * Initialize resizer event listeners
 * @throws {Error} If required DOM elements are not found
 */
export const initializeResizers = () => {
  // Safely retrieve and bind resizer elements
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

  // Attach event listeners
  selfResizer.addEventListener('mousedown', selfHandleMouseDown);
  oppResizer.addEventListener('mousedown', oppHandleMouseDown);
};

export default initializeResizers;