// Import necessary modules and dependencies
import {
  oppContainerDocument,
  selfContainerDocument,
  systemState,
} from '../../front-end.js';

// Import utility functions for board refresh and zone management
import { refreshBoard } from '../../setup/sizing/refresh-board.js';
import { getZone } from '../../setup/zones/get-zone.js';

// Import card visibility toggle functions
import { lookAtCards, stopLookingAtCards } from './reveal-and-hide.js';

// Import the resizer utility for managing container interactions
import createResizer from '../../setup/sizing/resizer.js';

// Safely select container elements from the DOM
// These are critical UI containers for the game interface
const selfContainer = document.getElementById('selfContainer');
const oppContainer = document.getElementById('oppContainer');

// Perform a critical safety check to ensure containers exist
// This prevents potential runtime errors if DOM elements are missing
if (!selfContainer || !oppContainer) {
  console.error('Container elements not found');
  throw new Error('Required container elements are missing');
}

// Initialize the resizer with container references
// The resizer manages mouse interactions and container behaviors
const {
  // Extract mouse event handlers for different container states
  flippedOppHandleMouseDown,
  flippedSelfHandleMouseDown,
  oppHandleMouseDown,
  selfHandleMouseDown
} = createResizer({
  // Pass container references to the resizer
  selfContainer,
  oppContainer,
  selfContainerDocument,
  oppContainerDocument
});

// Primary function to flip the game board
// Handles UI state changes when switching perspectives
export function flipBoard() {
  // Select critical UI elements using direct DOM queries
  // Each element represents a specific interactive component
  const selfResizer = document.getElementById('selfResizer');
  const oppResizer = document.getElementById('oppResizer');
  
  // Game action buttons
  const attackButton = document.getElementById('attackButton');
  const passButton = document.getElementById('passButton');
  const undoButton = document.getElementById('undoButton');
  const FREEBUTTON = document.getElementById('FREEBUTTON');
  const setupButton = document.getElementById('setupButton');
  const resetButton = document.getElementById('resetButton');

  // Player 2 specific buttons (for two-player mode)
  const p2AttackButton = document.getElementById('p2AttackButton');
  const p2PassButton = document.getElementById('p2PassButton');
  const p2FREEBUTTON = document.getElementById('p2FREEBUTTON');
  const p2SetupButton = document.getElementById('p2SetupButton');
  const p2ResetButton = document.getElementById('p2ResetButton');

  // Select board and view card elements using container documents
  // This ensures correct selection within the specific container context
  const boardElement = selfContainerDocument.getElementById('board');
  const oppBoardElement = oppContainerDocument.getElementById('board');
  const viewCardsElement = selfContainerDocument.getElementById('viewCards');
  const oppViewCardsElement = oppContainerDocument.getElementById('viewCards');

  // Determine the current game initiator and adjust event listeners accordingly
  if (systemState.initiator === 'self') {
    // Remove existing event listeners
    selfResizer.removeEventListener('mousedown', selfHandleMouseDown);
    oppResizer.removeEventListener('mousedown', oppHandleMouseDown);

    // Add flipped state event listeners
    selfResizer.addEventListener('mousedown', flippedSelfHandleMouseDown);
    oppResizer.addEventListener('mousedown', flippedOppHandleMouseDown);

    // Handle card visibility based on game mode and settings
    if (
      systemState.isTwoPlayer ||
      (!systemState.isTwoPlayer && 
       document.getElementById('hideHandCheckbox').checked)
    ) {
      lookAtCards('opp', '', 'hand', false, true);
      stopLookingAtCards('self', '', 'hand', false, true);
    }
  } else {
    // Restore original event listeners
    selfResizer.addEventListener('mousedown', selfHandleMouseDown);
    oppResizer.addEventListener('mousedown', oppHandleMouseDown);
    selfResizer.removeEventListener('mousedown', flippedSelfHandleMouseDown);
    oppResizer.removeEventListener('mousedown', flippedOppHandleMouseDown);

    // Handle card visibility for alternate initiator
    if (
      systemState.isTwoPlayer ||
      (!systemState.isTwoPlayer && 
       document.getElementById('hideHandCheckbox').checked)
    ) {
      lookAtCards('self', '', 'hand', false, true);
      stopLookingAtCards('opp', '', 'hand', false, true);
    }
  }

  // Toggle view cards element flip
  viewCardsElement.classList.toggle('flip-image');
  oppViewCardsElement.classList.toggle('flip-image');

  // Utility function to toggle classes between self and opponent states
  const toggleClasses = (element, class1, class2) => {
    element.classList.toggle(class1);
    element.classList.toggle(class2);
  };

  // Toggle various UI element classes to reflect board flip
  toggleClasses(selfResizer, 'self-color', 'opp-color');
  toggleClasses(oppResizer, 'opp-color', 'self-color');
  toggleClasses(selfContainer, 'self', 'opp');
  toggleClasses(oppContainer, 'opp', 'self');
  toggleClasses(boardElement, 'self-board', 'opp-board');
  toggleClasses(oppBoardElement, 'opp-board', 'self-board');

  // Toggle button colors
  const buttonElements = [
    attackButton, passButton, undoButton, FREEBUTTON,
    p2AttackButton, p2PassButton, p2FREEBUTTON,
    p2SetupButton, p2ResetButton
  ];
  buttonElements.forEach(button => {
    if (button) toggleClasses(button, 'self-color', 'opp-color');
  });

  // Toggle setup and reset buttons if not in replay mode
  if (!systemState.isReplay) {
    toggleClasses(setupButton, 'self-color', 'opp-color');
    toggleClasses(resetButton, 'self-color', 'opp-color');
  }

  // Toggle text and zone view classes
  const users = ['self', 'opp'];
  const textIds = [
    'deckText', 'discardText', 'lostZoneText', 'handText', 
    'sortHandText', 'sortHandCheckbox'
  ];
  const zoneIds = ['deck', 'discard', 'lostZone', 'attachedCards', 'viewCards'];
  const buttonContainers = ['viewCardsButtonContainer', 'attachedCardsButtonContainer'];
  const headerIds = ['attachedCardsHeader', 'viewCardsHeader'];
  const specialMoveButtonContainers = ['specialMoveButtonContainer'];

  // Iterate through users and toggle their respective UI classes
  users.forEach(user => {
    const targetDocument = user === 'self' ? selfContainerDocument : oppContainerDocument;

    // Toggle text classes
    textIds.forEach(textId => {
      const text = targetDocument.getElementById(textId);
      if (text) {
        text.classList.toggle('self-text');
        text.classList.toggle('opp-text');
      }
    });

    // Toggle zone view classes
    zoneIds.forEach(zoneId => {
      const element = targetDocument.getElementById(zoneId);
      if (element) {
        element.classList.toggle('self-view');
        element.classList.toggle('opp-view');
      }
    });

    // Toggle button container classes
    buttonContainers.forEach(containerId => {
      const container = targetDocument.getElementById(containerId);
      if (container) {
        container.classList.toggle('self-zone-button-container');
        container.classList.toggle('opp-zone-button-container');
      }
    });

    // Toggle header classes and swap header text
    headerIds.forEach(headerId => {
      const header = targetDocument.getElementById(headerId);
      if (header) {
        header.classList.toggle('self-header');
        header.classList.toggle('opp-header');
        
        if (header.textContent === 'Move attached cards') {
          header.textContent = 'Opponent moving cards...';
        } else if (header.textContent === 'Opponent moving cards...') {
          header.textContent = 'Move attached cards';
        }
      }
    });

    // Toggle special move button container classes
    specialMoveButtonContainers.forEach(containerId => {
      const container = targetDocument.getElementById(containerId);
      if (container) {
        container.classList.toggle('self-special-move-button-container');
        container.classList.toggle('opp-special-move-button-container');
      }
    });
  });

  // Toggle circle element classes
  const toggleCircleElements = (containerDocument) => {
    const circleElements = containerDocument.querySelectorAll('.self-circle, .opp-circle');
    circleElements.forEach(element => {
      element.classList.toggle('self-circle');
      element.classList.toggle('opp-circle');
    });
  };

  toggleCircleElements(selfContainerDocument);
  toggleCircleElements(oppContainerDocument);

  // Swap container heights and bottom positions
  let tempHeight = selfContainer.style.height;
  selfContainer.style.height = oppContainer.style.height;
  oppContainer.style.height = tempHeight;

  let tempBottom = selfContainer.style.bottom;
  selfContainer.style.bottom = oppContainer.style.bottom;
  oppContainer.style.bottom = tempBottom;

  // Handle stadium zone flipping
  const stadiumZone = getZone('', 'stadium');
  if (stadiumZone.array[0]) {
    stadiumZone.element.style.transform = 
      stadiumZone.array[0].image.user === systemState.initiator 
        ? 'scaleX(1) scaleY(1)' 
        : 'scaleX(-1) scaleY(-1)';
  }

  // Refresh the board to apply all changes
  refreshBoard();
}