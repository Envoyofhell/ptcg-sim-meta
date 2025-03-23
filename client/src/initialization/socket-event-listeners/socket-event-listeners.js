// File: client/src/initialization/socket-event-listeners/socket-event-listeners.js
/**
 * Socket.IO Event Listeners
 * 
 * Initializes all event listeners for Socket.IO events with
 * enhanced error handling and offline mode support.
 */
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
import { socket, systemState } from '../../front-end.js';
import { appendMessage } from '../../setup/chatbox/append-message.js';
import { exchangeData } from '../../setup/deck-constructor/exchange-data.js';
import { acceptAction } from '../../setup/general/accept-action.js';
import { catchUpActions } from '../../setup/general/catch-up-actions.js';
import { cleanActionData } from '../../setup/general/clean-action-data.js';
import { resyncActions } from '../../setup/general/resync-actions.js';
import { spectatorJoin } from '../../setup/spectator/spectator-join.js';
import { startKeybindsSleep } from '../../actions/keybinds/keybindSleep.js';

// Setup interval tracking
let isImporting = false;
let syncCheckInterval;
let spectatorActionInterval;

/**
 * Remove sync intervals when closing a session
 */
export const removeSyncIntervals = () => {
  clearInterval(syncCheckInterval);
  clearInterval(spectatorActionInterval);
};

/**
 * Ensure all necessary data structures are initialized
 * This prevents errors when running in offline mode
 */
function ensureDataStructuresInitialized() {
  // Initialize action data arrays if they don't exist
  if (!Array.isArray(systemState.exportActionData)) {
    systemState.exportActionData = [];
    console.log('[Socket] Initialized exportActionData array');
  }
  
  if (!Array.isArray(systemState.replayActionData)) {
    systemState.replayActionData = [];
    console.log('[Socket] Initialized replayActionData array');
  }
  
  if (!systemState.actionData) {
    systemState.actionData = {
      self: [],
      opponent: [],
      spectator: []
    };
    console.log('[Socket] Initialized actionData object');
  }
  
  // Ensure all nested arrays exist
  if (!Array.isArray(systemState.actionData.self)) {
    systemState.actionData.self = [];
  }
  
  if (!Array.isArray(systemState.actionData.opponent)) {
    systemState.actionData.opponent = [];
  }
  
  if (!Array.isArray(systemState.actionData.spectator)) {
    systemState.actionData.spectator = [];
  }
}

/**
 * Initialize Socket.IO event listeners
 * With enhanced error handling and offline mode support
 */
export const initializeSocketEventListeners = () => {
  // Ensure data structures are initialized
  ensureDataStructuresInitialized();
  
  // Check if socket exists
  if (!socket) {
    console.warn('[Socket] No socket instance available, using offline mode');
    createOfflineEventHandlers();
    return;
  }

  // Connection state handling
  socket.on('connect', () => {
    console.log('[Socket] Connected successfully');
    document.getElementById('chatbox').innerHTML += '<div style="color: green; font-weight: bold">Connected to server</div>';
  });

  socket.on('disconnect', () => {
    console.warn('[Socket] Disconnected from server');
    document.getElementById('chatbox').innerHTML += '<div style="color: red; font-weight: bold">Disconnected from server</div>';
    
    // Continue in offline mode
    createOfflineEventHandlers();
  });

  socket.on('connect_error', (error) => {
    console.error(`[Socket] Connection error: ${error.message}`);
    document.getElementById('chatbox').innerHTML += '<div style="color: red; font-weight: bold">Failed to connect to server. Some multiplayer features may be limited.</div>';
  });

  // Game event handlers
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

    // Initialize sync checker
    syncCheckInterval = setInterval(() => {
      if (systemState.isTwoPlayer) {
        const data = {
          roomId: systemState.roomId,
          counter: systemState.selfCounter,
        };
        safeSocketEmit('syncCheck', data);
      }
    }, 3000);

    // Initialize spectator action interval
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
        safeSocketEmit('spectatorActionData', data);
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
  
  // Reconnection handling
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
  
  // Game state import/export handling
  socket.on('initiateImport', () => {
    systemState.spectatorCounter = 0; //reset spectator counter to make sure it catches all of the actions
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
        // systemState.spectatorActionData.push({user: 'opp', emit: true, action: data.action, parameters: data.parameters});
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
        const data = {
          roomId: systemState.roomId,
          counter: systemState.oppCounter,
        };
        socket.emit('resyncActions', data);
      }
    }
  });
  
  // Sync and game state handlers
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
      const data = {
        roomId: systemState.roomId,
        counter: systemState.oppCounter,
      };
      socket.emit('resyncActions', data);
    }
  });
  
  // Card action handlers
  socket.on('lookAtCards', (data) => {
    if (data.socketId === systemState.spectatorId) {
      data.user = data.user === 'self' ? 'opp' : 'self';
      data.initiator = data.initiator === 'self' ? 'opp' : 'self';
    }
    lookAtCards(
      data.user,
      data.initiator,
      data.zoneId,
      data.message,
      data.emit
    );
  });
  
  socket.on('stopLookingAtCards', (data) => {
    if (data.socketId === systemState.spectatorId) {
      data.user = data.user === 'self' ? 'opp' : 'self';
      data.initiator = data.initiator === 'self' ? 'opp' : 'self';
    }
    stopLookingAtCards(
      data.user,
      data.initiator,
      data.zoneId,
      data.message,
      data.emit
    );
  });
  
  socket.on('revealCards', (data) => {
    if (data.socketId === systemState.spectatorId) {
      data.user = data.user === 'self' ? 'opp' : 'self';
      data.initiator = data.initiator === 'self' ? 'opp' : 'self';
    }
    revealCards(data.user, data.initiator, data.zoneId, data.emit);
  });
  
  socket.on('hideCards', (data) => {
    if (data.socketId === systemState.spectatorId) {
      data.user = data.user === 'self' ? 'opp' : 'self';
      data.initiator = data.initiator === 'self' ? 'opp' : 'self';
    }
    hideCards(data.user, data.initiator, data.zoneId, data.emit);
  });
  
  socket.on('revealShortcut', (data) => {
    if (data.socketId === systemState.spectatorId) {
      data.user = data.user === 'self' ? 'opp' : 'self';
      data.initiator = data.initiator === 'self' ? 'opp' : 'self';
    }
    revealShortcut(
      data.user,
      data.initiator,
      data.zoneId,
      data.index,
      data.message,
      data.emit
    );
  });
  
  socket.on('hideShortcut', (data) => {
    if (data.socketId === systemState.spectatorId) {
      data.user = data.user === 'self' ? 'opp' : 'self';
      data.initiator = data.initiator === 'self' ? 'opp' : 'self';
    }
    hideShortcut(
      data.user,
      data.initiator,
      data.zoneId,
      data.index,
      data.message,
      data.emit
    );
  });
  
  socket.on('lookShortcut', (data) => {
    if (data.socketId === systemState.spectatorId) {
      data.user = data.user === 'self' ? 'opp' : 'self';
      data.initiator = data.initiator === 'self' ? 'opp' : 'self';
    }
    lookShortcut(data.user, data.initiator, data.zoneId, data.index, data.emit);
  });
  
  socket.on('stopLookingShortcut', (data) => {
    if (data.socketId === systemState.spectatorId) {
      data.user = data.user === 'self' ? 'opp' : 'self';
      data.initiator = data.initiator === 'self' ? 'opp' : 'self';
    }
    stopLookingShortcut(
      data.user,
      data.initiator,
      data.zoneId,
      data.index,
      data.emit
    );
  });
  
  // Game state export handlers
  socket.on('exportGameStateSuccessful', (key) => {
    const url = `https://ptcg-sim-meta.pages.dev/import?key=${key}`;
    appendMessage('self', url, 'announcement', false);
  });
  
  socket.on('exportGameStateFailed', (message) => {
    appendMessage('self', message, 'announcement', false);
  });

  // Add a heartbeat mechanism
  setInterval(() => {
    if (socket && socket.connected) {
      socket.emit('heartbeat');
    }
  }, 25000);
};

/**
 * Creates offline event handlers for local play
 * Provides fallback functionality when Socket.IO is unavailable
 */
function createOfflineEventHandlers() {
  console.log('[Socket] Setting up offline event handlers');
  
  // Shows offline mode notice in the chatbox
  const chatbox = document.getElementById('chatbox');
  if (chatbox) {
    chatbox.innerHTML += `
      <div style="background-color: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <strong>Running in offline mode</strong><br>
        Multiplayer features are limited. Game data will be stored locally.
      </div>
    `;
  }
  
  // Make sure systemState arrays are initialized
  ensureDataStructuresInitialized();
  
  // Safely emit socket events even in offline mode
  window.safeSocketEmit = function(eventName, ...args) {
    console.log(`[Socket-Offline] Local event: ${eventName}`, args);
    
    // Handle specific events
    if (eventName === 'storeGameState') {
      const exportData = args[0];
      
      // Use the REST API instead of Socket.IO
      fetch('/api/storeGameState', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameState: exportData })
      })
      .then(response => response.json())
      .then(result => {
        if (result.success && result.key) {
          const url = `https://ptcg-sim-meta.pages.dev/import?key=${result.key}`;
          appendMessage('self', url, 'announcement', false);
        } else {
          appendMessage('self', 'Error exporting game. Please try again or save as a file.', 'announcement', false);
        }
      })
      .catch(error => {
        appendMessage('self', 'Error exporting game. Please try again or save as a file.', 'announcement', false);
      });
    }
  };
}

/**
 * Safe Socket.IO event emission with offline fallback
 * 
 * @param {string} eventName - Socket.IO event name
 * @param {*} args - Event arguments
 */
export function safeSocketEmit(eventName, ...args) {
  if (socket && socket.connected) {
    socket.emit(eventName, ...args);
  } else if (window.safeSocketEmit) {
    window.safeSocketEmit(eventName, ...args);
  } else {
    console.warn(`[Socket] Cannot emit ${eventName}. Socket not available.`);
  }
}