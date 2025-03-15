/**
 * Window Event Initialization
 * Sets up event listeners for window events (e.g., resize)
 */
import { adjustAlignment } from '../../../setup/sizing/adjust-alignment.js';
import { refreshBoard } from '../../../setup/sizing/refresh-board.js';

/**
 * Initialize window event listeners
 * Handles window resize events for responsive layout adjustments
 */
export const initializeWindow = () => {
  try {
    // Add resize event listener to the window
    window.addEventListener('resize', () => {
      try {
        // Use document.querySelector instead of selfContainerDocument.getElementById
        const handElement = document.querySelector('#selfContainer #hand');
        const oppHandElement = document.querySelector('#oppContainer #hand');
        
        // Only adjust alignment if elements exist
        if (handElement) {
          adjustAlignment(handElement);
        } else {
          console.warn('Self hand element not found, skipping alignment');
        }
        
        if (oppHandElement) {
          adjustAlignment(oppHandElement);
        } else {
          console.warn('Opponent hand element not found, skipping alignment');
        }
        
        // Refresh the board layout
        refreshBoard();
        
      } catch (error) {
        console.error("Error adjusting alignment:", error);
      }
    });
    
    // Log successful initialization
    console.log('Window resize handlers initialized successfully');
  } catch (error) {
    console.error('Error initializing window handlers:', error);
  }
};