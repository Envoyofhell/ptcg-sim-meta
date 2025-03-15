import { adjustAlignment } from '../../setup/sizing/adjust-alignment.js';

export const initializeHandObserver = () => {
  // Safely get elements
  const handElement = document.querySelector('#selfContainer #hand');
  const oppHandElement = document.querySelector('#oppContainer #hand');

  // Check if elements exist
  if (!handElement || !oppHandElement) {
    console.warn('Hand observer: Required elements not found. Will retry later.');
    setTimeout(initializeHandObserver, 500);
    return;
  }

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
  
  console.log('Hand observer initialized successfully');
};