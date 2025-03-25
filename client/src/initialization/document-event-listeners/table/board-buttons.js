import { VSTARGXFunction } from '../../../actions/general/VSTAR-GX.js';
import { flipBoard } from '../../../actions/general/flip-board.js';
import { flipCoin } from '../../../actions/general/flip-coin.js';
import { takeTurn } from '../../../actions/general/take-turn.js';
import {
  oppContainerDocument,
  selfContainerDocument,
  systemState,
} from '../../../front-end.js';
import { refreshBoardImages } from '../../../setup/sizing/refresh-board.js';

// Flag to prevent multiple initializations
let boardButtonsInitialized = false;

export const initializeBoardButtons = () => {
  // Prevent multiple initializations
  if (boardButtonsInitialized) return;
  boardButtonsInitialized = true;

  const turnButton = document.getElementById('turnButton');
  const flipCoinButton = document.getElementById('flipCoinButton');
  const flipBoardButton = document.getElementById('flipBoardButton');
  const refreshButton = document.getElementById('refreshButton');

  // Main buttons
  if (turnButton) {
    turnButton.addEventListener('click', () =>
      takeTurn(systemState.initiator, systemState.initiator)
    );
  }

  if (flipCoinButton) {
    flipCoinButton.addEventListener('click', () =>
      flipCoin(systemState.initiator)
    );
  }

  if (flipBoardButton) {
    flipBoardButton.addEventListener('click', flipBoard);
  }

  if (refreshButton) {
    refreshButton.addEventListener('click', refreshBoardImages);
  }

  // Iframe buttons initialization
  const initializeIframeButtons = () => {
    // Self VSTAR Button
    const selfVSTARButton = selfContainerDocument.getElementById('VSTARButton');
    if (selfVSTARButton) {
      // Remove any existing listeners first
      const clonedButton = selfVSTARButton.cloneNode(true);
      selfVSTARButton.parentNode.replaceChild(clonedButton, selfVSTARButton);

      clonedButton.addEventListener('click', () => {
        if (
          !(
            systemState.isTwoPlayer &&
            document.getElementById('spectatorModeCheckbox').checked
          ) &&
          !systemState.isReplay
        ) {
          VSTARGXFunction('self', 'VSTAR');
        }
      });
    }

    // Self GX Button
    const selfGXButton = selfContainerDocument.getElementById('GXButton');
    if (selfGXButton) {
      // Remove any existing listeners first
      const clonedButton = selfGXButton.cloneNode(true);
      selfGXButton.parentNode.replaceChild(clonedButton, selfGXButton);

      clonedButton.addEventListener('click', () => {
        if (
          !(
            systemState.isTwoPlayer &&
            document.getElementById('spectatorModeCheckbox').checked
          ) &&
          !systemState.isReplay
        ) {
          VSTARGXFunction('self', 'GX');
        }
      });
    }
    // Self Forte Button
    const selfForteButton = selfContainerDocument.getElementById('ForteButton');
    if (selfForteButton) {
      // Remove any existing listeners first
      const clonedButton = selfForteButton.cloneNode(true);
      selfForteButton.parentNode.replaceChild(clonedButton, selfForteButton);

      clonedButton.addEventListener('click', () => {
        if (
          !(
            systemState.isTwoPlayer &&
            document.getElementById('spectatorModeCheckbox').checked
          ) &&
          !systemState.isReplay
        ) {
          VSTARGXFunction('self', 'Forte');
        }
      });
    }
    // Opponent VSTAR Button
    const oppVSTARButton = oppContainerDocument.getElementById('VSTARButton');
    if (oppVSTARButton) {
      // Remove any existing listeners first
      const clonedButton = oppVSTARButton.cloneNode(true);
      oppVSTARButton.parentNode.replaceChild(clonedButton, oppVSTARButton);

      clonedButton.addEventListener('click', () => {
        if (
          !(
            systemState.isTwoPlayer &&
            document.getElementById('spectatorModeCheckbox').checked
          ) &&
          !systemState.isReplay
        ) {
          VSTARGXFunction('opp', 'VSTAR');
        }
      });
    }

    // Opponent GX Button
    const oppGXButton = oppContainerDocument.getElementById('GXButton');
    if (oppGXButton) {
      // Remove any existing listeners first
      const clonedButton = oppGXButton.cloneNode(true);
      oppGXButton.parentNode.replaceChild(clonedButton, oppGXButton);

      clonedButton.addEventListener('click', () => {
        if (
          !(
            systemState.isTwoPlayer &&
            document.getElementById('spectatorModeCheckbox').checked
          ) &&
          !systemState.isReplay
        ) {
          VSTARGXFunction('opp', 'GX');
        }
      });
    }
    // Opponent Forte Button
    const oppForteButton = oppContainerDocument.getElementById('ForteButton');
    if (oppForteButton) {
      // Remove any existing listeners first
      const clonedButton = oppForteButton.cloneNode(true);
      oppForteButton.parentNode.replaceChild(clonedButton, oppForteButton);

      clonedButton.addEventListener('click', () => {
        if (
          !(
            systemState.isTwoPlayer &&
            document.getElementById('spectatorModeCheckbox').checked
          ) &&
          !systemState.isReplay
        ) {
          VSTARGXFunction('opp', 'Forte');
        }
      });
    }
  };

  // Ensure buttons are initialized
  initializeIframeButtons();

  // Fallback for iframe loading
  const selfContainer = document.getElementById('selfContainer');
  const oppContainer = document.getElementById('oppContainer');

  if (selfContainer) {
    selfContainer.addEventListener('load', initializeIframeButtons);
  }

  if (oppContainer) {
    oppContainer.addEventListener('load', initializeIframeButtons);
  }
};
