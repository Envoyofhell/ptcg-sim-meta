import { flipBoard } from '../../actions/general/flip-board.js';
import { reset } from '../../actions/general/reset.js';
import {
  hideCards,
  hideShortcut,
  lookAtCards,
  lookShortcut,
  revealCards,
  revealShortcut,
  stopLookingAtCards,
  stopLookingShortcut,
} from '../../actions/general/reveal-and-hide.js';
import {
  socket,
  systemState,
} from './initialization/global-variables/global-variables.js';
//import { socket, systemState } from '../../front-end.js';
import { appendMessage } from '../../setup/chatbox/append-message.js';
import { exchangeData } from '../../setup/deck-constructor/exchange-data.js';
import { acceptAction } from '../../setup/general/accept-action.js';
import { catchUpActions } from '../../setup/general/catch-up-actions.js';
import { cleanActionData } from '../../setup/general/clean-action-data.js';
import { resyncActions } from '../../setup/general/resync-actions.js';
import { spectatorJoin } from '../../setup/spectator/spectator-join.js';
import { startKeybindsSleep } from '../../actions/keybinds/keybindSleep.js';

let isImporting = false;
let syncCheckInterval;
let spectatorActionInterval;

// Function to clear sync intervals
export const removeSyncIntervals = () => {
  clearInterval(syncCheckInterval);
  clearInterval(spectatorActionInterval);
};

// Function to initialize socket event listeners
export const initializeSocketEventListeners = () => {
  socket.on('joinGame', () => {
    const connectedRoom = document.getElementById('connectedRoom');
    const lobby = document.getElementById('lobby');
    const roomHeaderText = document.getElementById('roomHeaderText');
    const chatbox = document.getElementById('chatbox');
    const p2ExplanationBox = document.getElementById('p2ExplanationBox');
    const flipBoardButton = document.getElementById('flipBoardButton');

    roomHeaderText.textContent = 'id: ' + systemState.roomId;
    chatbox.innerHTML = '';
    connectedRoom.style.display = 'flex';
    lobby.style.display = 'none';
    p2ExplanationBox.style.display = 'none';
    flipBoardButton.style.display = 'none';

    if (systemState.initiator === 'opp') {
      flipBoard();
    }

    systemState.isTwoPlayer = true;
    cleanActionData('self');
    cleanActionData('opp');
    reset('opp', true, false, false, false);
    exchangeData(
      'self',
      systemState.p2SelfUsername,
      systemState.selfDeckData,
      systemState.cardBackSrc,
      document.getElementById('coachingModeCheckbox').checked
    );

    // Sync checks to ensure game states are matched
    syncCheckInterval = setInterval(() => {
      if (systemState.isTwoPlayer) {
        const data = {
          roomId: systemState.roomId,
          counter: systemState.selfCounter,
        };
        socket.emit('syncCheck', data);
      }
    }, 3000);

    spectatorActionInterval = setInterval(() => {
      if (systemState.isTwoPlayer) {
        const data = {
          selfUsername: systemState.p2SelfUsername,
          selfDeckData: systemState.selfDeckData,
          oppDeckData: systemState.p2OppDeckData,
          oppUsername: systemState.p2OppUsername,
          roomId: systemState.roomId,
          spectatorActionData: systemState.exportActionData,
          socketId: socket.id,
        };
        socket.emit('spectatorActionData', data);
      }
    }, 1000);
  });

  socket.on('spectatorJoin', () => {
    spectatorJoin();
  });

  socket.on('roomReject', () => {
    let overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';

    let container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.textAlign = 'center';
    container.style.color = '#fff';

    let message = document.createElement('p');
    message.innerHTML =
      'Room is full.<br>Enable spectator mode to watch the game.';
    message.style.fontSize = '24px';

    container.appendChild(message);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
  });

  socket.on('connect', () => {
    const notSpectator = !(
      document.getElementById('spectatorModeCheckbox').checked &&
      systemState.isTwoPlayer
    );
    if (systemState.isTwoPlayer) {
      const data = {
        roomId: systemState.roomId,
        username: systemState.p2SelfUsername,
        notSpectator: notSpectator,
      };
      socket.emit('userReconnected', data);
      if (!notSpectator) {
        appendMessage(
          '',
          systemState.spectatorUsername + ' reconnected!',
          'announcement',
          false
        );
      }
    }
  });

  socket.on('userReconnected', (data) => {
    appendMessage('', data.username + ' reconnected!', 'announcement', false);
  });

  socket.on('userDisconnected', (username) => {
    appendMessage('', username + ' disconnected', 'announcement', false);
  });

  socket.on('disconnect', () => {
    if (systemState.isTwoPlayer) {
      const isSpectator =
        systemState.isTwoPlayer &&
        document.getElementById('spectatorModeCheckbox').checked;
      const username = isSpectator
        ? systemState.spectatorUsername
        : systemState.p2SelfUsername;
      appendMessage('', username + ' disconnected', 'announcement', false);
    }
  });

  socket.on('leaveRoom', (data) => {
    if (!data.isSpectator) {
      cleanActionData('opp');
    }
    appendMessage('', data.username + ' left the room', 'announcement', false);
  });

  socket.on('appendMessage', (data) => {
    if (data.socketId === systemState.spectatorId) {
      data.user = data.user === 'self' ? 'opp' : 'self';
    }
    appendMessage(data.user, data.message, data.type, data.emit);
  });

  socket.on('requestAction', (data) => {
    const notSpectator = !(
      document.getElementById('spectatorModeCheckbox').checked &&
      systemState.isTwoPlayer
    );
    if (
      (notSpectator && data.counter === systemState.selfCounter) ||
      isImporting
    ) {
      startKeybindsSleep();
      acceptAction('self', data.action, data.parameters);
    }
  });

  // Reset counter when importing game state
  socket.on('initiateImport', () => {
    systemState.spectatorCounter = 0; // Reset spectator counter to ensure it catches all actions
    isImporting = true;
    cleanActionData('self');
    cleanActionData('opp');
  });

  socket.on('endImport', () => {
    isImporting = false;
  });

  socket.on('pushAction', (data) => {
    const notSpectator = !(
      document.getElementById('spectatorModeCheckbox').checked &&
      systemState.isTwoPlayer
    );
    if (notSpectator) {
      if (data.action === 'exchangeData') {
        cleanActionData('opp');
      }
      if (data.counter === parseInt(systemState.oppCounter) + 1) {
        systemState.oppCounter++;
        if (data.action !== 'exchangeData' && data.action !== 'loadDeckData') {
          systemState.exportActionData.push({
            user: 'opp',
            emit: true,
            action: data.action,
            parameters: data.parameters,
          });
        }
        startKeybindsSleep();
        acceptAction('opp', data.action, data.parameters);
      } else if (data.counter > parseInt(systemState.oppCounter) + 1) {
        const syncData = {
          roomId: systemState.roomId,
          counter: systemState.oppCounter,
        };
        socket.emit('resyncActions', syncData);
      }
    }
  });

  socket.on('resyncActions', () => {
    const notSpectator = !(
      document.getElementById('spectatorModeCheckbox').checked &&
      systemState.isTwoPlayer
    );
    if (notSpectator) {
      resyncActions();
    }
  });

  socket.on('catchUpActions', (data) => {
    const notSpectator = !(
      document.getElementById('spectatorModeCheckbox').checked &&
      systemState.isTwoPlayer
    );
    if (notSpectator) {
      catchUpActions(data.actionData);
    }
  });

  socket.on('syncCheck', (data) => {
    const notSpectator = !(
      document.getElementById('spectatorModeCheckbox').checked &&
      systemState.isTwoPlayer
    );
    if (notSpectator && data.counter >= parseInt(systemState.oppCounter) + 1) {
      const syncData = {
        roomId: systemState.roomId,
        counter: systemState.oppCounter,
      };
      socket.emit('resyncActions', syncData);
    }
  });

  socket.on('exportGameStateSuccessful', (key) => {
    const url = `https://ptcg-sim-meta.vercel.app/import?key=${key}`; // Update to Vercel URL
    appendMessage('self', url, 'announcement', false);
  });

  socket.on('exportGameStateFailed', (message) => {
    appendMessage('self', message, 'announcement', false);
  });
};
