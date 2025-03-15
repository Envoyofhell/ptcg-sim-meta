/**
 * Mutation Observers Initialization Module
 * Coordinates initialization of all mutation observers
 */
import { initializeBoardObserver } from './board-observer.js';
import { initializeHandObserver } from './hand-observer.js';
import { initializePrizesObserver } from './prizes-observer.js';
import { initializeStadiumObserver } from './stadium-observer.js';
import { logInfo, logError } from '../error-tracking.js';

/**
 * Initialize all mutation observers
 * This starts the observers that watch for DOM changes
 */
export const initializeMutationObservers = () => {
  logInfo('Setting up mutation observers...');
  
  try {
    // Start each observer independently
    // Note: Each observer handles its own retries and error reporting
    initializeBoardObserver();
    initializeHandObserver();
    initializePrizesObserver();
    initializeStadiumObserver();
  } catch (error) {
    logError('Failed to initialize mutation observers:', error);
  }
};