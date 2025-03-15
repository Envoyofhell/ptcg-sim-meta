import { VSTARGXFunction } from '../../../actions/general/VSTAR-GX.js';
import { flipBoard } from '../../../actions/general/flip-board.js';
import { flipCoin } from '../../../actions/general/flip-coin.js';
import { takeTurn } from '../../../actions/general/take-turn.js';
import { systemState } from '../../../front-end.js';
import { refreshBoardImages } from '../../../setup/sizing/refresh-board.js';

export const initializeBoardButtons = () => {
  try {
    const turnButton = document.getElementById('turnButton');
    if (turnButton) {
      turnButton.addEventListener('click', () =>
        takeTurn(systemState.initiator, systemState.initiator)
      );
    }

    const flipCoinButton = document.getElementById('flipCoinButton');
    if (flipCoinButton) {
      flipCoinButton.addEventListener('click', () =>
        flipCoin(systemState.initiator)
      );
    }

    const flipBoardButton = document.getElementById('flipBoardButton');
    if (flipBoardButton) {
      flipBoardButton.addEventListener('click', flipBoard);
    }

    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
      refreshButton.addEventListener('click', refreshBoardImages);
    }

    // Use document.querySelector instead of selfContainerDocument.getElementById
    const selfVSTARButton = document.querySelector('#selfContainer #VSTARButton');
    if (selfVSTARButton) {
      selfVSTARButton.addEventListener('click', () => {
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

    const selfGXButton = document.querySelector('#selfContainer #GXButton');
    if (selfGXButton) {
      selfGXButton.addEventListener('click', () => {
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

    const selfForteButton = document.querySelector('#selfContainer #ForteButton');
    if (selfForteButton) {
      selfForteButton.addEventListener('click', () => {
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

    const oppVSTARButton = document.querySelector('#oppContainer #VSTARButton');
    if (oppVSTARButton) {
      oppVSTARButton.addEventListener('click', () => {
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

    const oppGXButton = document.querySelector('#oppContainer #GXButton');
    if (oppGXButton) {
      oppGXButton.addEventListener('click', () => {
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

    const oppForteButton = document.querySelector('#oppContainer #ForteButton');
    if (oppForteButton) {
      oppForteButton.addEventListener('click', () => {
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
    
    console.log('Board buttons initialized successfully');
  } catch (error) {
    console.error('Error initializing board buttons:', error);
  }
};