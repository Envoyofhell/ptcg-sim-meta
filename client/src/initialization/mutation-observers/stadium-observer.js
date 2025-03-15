// Stadium Observer Module
// This module observes elements and updates the z-index of stadium elements

// Deferred initialization to ensure DOM is ready
export const initializeStadiumObserver = () => {
  const zoneIds = ['lostZone', 'deck', 'discard', 'attachedCards', 'viewCards'];
  
  // Use document.querySelector to find elements instead of assuming container documents
  const selfElements = zoneIds.map((zoneId) =>
    document.querySelector(`#selfContainer #${zoneId}`)
  );
  
  const oppElements = zoneIds.map((zoneId) =>
    document.querySelector(`#oppContainer #${zoneId}`)
  );
  
  // Filter out any elements that weren't found
  const elements = [...selfElements, ...oppElements].filter(el => el !== null);
  
  // Check if we have the required elements before proceeding
  const stadiumElement = document.getElementById('stadium');
  const boardButtonContainer = document.getElementById('boardButtonContainer');
  
  if (!stadiumElement || !boardButtonContainer || elements.length === 0) {
    console.warn('Stadium observer: Not all required elements found. Will retry later.');
    // Retry initialization after a short delay
    setTimeout(initializeStadiumObserver, 500);
    return;
  }

  // Function to check the display of the elements and update the z-index of stadiumElement
  const checkDisplayAndUpdateZIndex = () => {
    for (let i = 0; i < elements.length; i++) {
      if (elements[i].style.display === 'block') {
        stadiumElement.style.zIndex = '-1';
        boardButtonContainer.style.zIndex = '-1';
        return; // Exit the function if an element is displayed
      }
    }
    // If none of the elements are displayed, set the z-index to 0
    stadiumElement.style.zIndex = '0';
    boardButtonContainer.style.zIndex = '0';
  };

  // Create a MutationObserver instance
  const observer = new MutationObserver(checkDisplayAndUpdateZIndex);

  // Options for the observer (which mutations to observe)
  const config = { attributes: true, attributeFilter: ['style'] };

  // Start observing each element for configured mutations
  elements.forEach((element) => {
    if (element) {
      observer.observe(element, config);
    }
  });
  
  console.log('Stadium observer initialized successfully with', elements.length, 'elements');
};