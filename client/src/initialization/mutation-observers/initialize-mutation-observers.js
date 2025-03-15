import { initializeBoardObserver } from './board-observer.js';
import { initializeHandObserver } from './hand-observer.js';
import { initializePrizesObserver } from './prizes-observer.js';
import { initializeStadiumObserver } from './stadium-observer.js';
import { onDOMReady, initializeWhenReady } from '../dom-ready-helper.js';

/**
 * Initialize all mutation observers with proper DOM readiness checks
 */
export const initializeMutationObservers = () => {
  console.log('Setting up mutation observers...');
  
  // Only initialize observers when DOM is fully loaded
  onDOMReady(() => {
    console.log('DOM is ready, starting observer initialization');
    
    // Define the required elements for each observer
    const observerConfig = [
      {
        name: 'Board Observer',
        init: initializeBoardObserver,
        selectors: ['#selfContainer #board', '#oppContainer #board']
      },
      {
        name: 'Hand Observer',
        init: initializeHandObserver,
        selectors: ['#selfContainer #hand', '#oppContainer #hand']
      },
      {
        name: 'Prizes Observer',
        init: initializePrizesObserver,
        selectors: ['#selfContainer #prizes', '#oppContainer #prizes']
      },
      {
        name: 'Stadium Observer',
        init: initializeStadiumObserver,
        selectors: ['#stadium', '#boardButtonContainer']
      }
    ];
    
    // Initialize each observer with its required elements
    observerConfig.forEach(config => {
      initializeWhenReady(config.init, config.selectors, config.name);
    });
  });
};