const scrollToBottom = (element) => {
  if (element) {
    element.scrollTop = element.scrollHeight;
  }
};

const handleMutations = (element, mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      scrollToBottom(element);
    }
  });
};

export const initializeBoardObserver = () => {
  // Safely get elements
  const boardElement = document.querySelector('#selfContainer #board');
  const oppBoardElement = document.querySelector('#oppContainer #board');

  // Check if elements exist
  if (!boardElement || !oppBoardElement) {
    console.warn('Board observer: Required elements not found. Will retry later.');
    setTimeout(initializeBoardObserver, 500);
    return;
  }

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
  
  console.log('Board observer initialized successfully');
};