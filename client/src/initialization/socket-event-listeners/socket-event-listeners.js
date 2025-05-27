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

let isImporting = false;
let syncCheckInterval;
let spectatorActionInterval;
export const removeSyncIntervals = () => {
  clearInterval(syncCheckInterval);
  clearInterval(spectatorActionInterval);
};
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

    // Notify chat interface that room was joined
    const chatInterface = document.getElementById('chatInterface');
    if (chatInterface && chatInterface.contentWindow) {
      chatInterface.contentWindow.postMessage(
        {
          type: 'roomJoined',
          data: {
            roomId: systemState.roomId,
            playerName: systemState.p2SelfUsername,
          },
        },
        '*'
      );

      // Update game state to multiplayer
      chatInterface.contentWindow.postMessage(
        {
          type: 'updateGameState',
          data: {
            isMultiplayer: true,
            mode: 'Multiplayer',
            isConnected: true,
          },
        },
        '*'
      );

      // Update connection status
      chatInterface.contentWindow.postMessage(
        {
          type: 'updateConnectionStatus',
          data: {
            connected: true,
            text: 'Connected',
          },
        },
        '*'
      );

      // Initial player list (just self for now, opponent will be added when they join)
      chatInterface.contentWindow.postMessage(
        {
          type: 'updatePlayerList',
          data: {
            players: [{ id: 'self', name: systemState.p2SelfUsername }],
            spectators: [],
          },
        },
        '*'
      );
    }

    //initialize sync checker, which will routinely make sure game are synced
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
  socket.on('roomFull', (data) => {
    // Show room full modal with spectator option
    showRoomFullModal(data);
  });

  socket.on('userJoined', (data) => {
    // Notify chat interface about new user
    const chatInterface = document.getElementById('chatInterface');
    if (chatInterface && chatInterface.contentWindow) {
      chatInterface.contentWindow.postMessage(
        {
          type: 'playerJoined',
          data: {
            username: data.username,
            isSpectator: data.isSpectator,
            playerCount: data.playerCount,
            spectatorCount: data.spectatorCount,
          },
        },
        '*'
      );
    }

    // Add message to main chat
    const userType = data.isSpectator ? 'spectator' : 'player';
    appendMessage(
      '',
      `${data.username} joined as ${userType}`,
      'announcement',
      false
    );
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
  socket.on('message', (data) => {
    // Handle incoming multiplayer chat messages
    const username = data.username || 'Player';
    const message = data.message || data;

    // Add to main chat log
    appendMessage('opp', `${username}: ${message}`, 'message', true);

    // Send to IRC chat interface for multiplayer channel
    const chatFrame = document.getElementById('chatInterface');
    if (chatFrame && chatFrame.contentWindow) {
      chatFrame.contentWindow.postMessage(
        {
          type: 'multiplayerMessage',
          data: {
            username: username,
            message: message,
            messageType: 'opp',
          },
        },
        '*'
      );
    }
    if (window.sendToIRCChat) {
      window.sendToIRCChat('multiplayerMessage', {
        messageType: 'opp',
        username: username,
        message: message,
        timestamp: new Date().toISOString(),
      });
    }
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
  // reset counter when importing game state
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
  // socket.on('exchangeData', (data) => {
  //     exchangeData(data.user, data.username, data.deckData, data.emit);
  // });
  // socket.on('loadDeckData', (data) => {
  //     loadDeckData(data.user, data.deckData, data.emit);
  // });
  // socket.on('reset', (data) => {
  //     reset(data.user, data.clean, data.build, data.invalidMessage, data.emit);
  // });
  // socket.on('setup', (data) => {
  //     setup(data.user, data.indices, data.emit);
  // });
  // socket.on('takeTurn', (data) => {
  //     takeTurn(data.user, data.initiator, data.emit);
  // });
  // socket.on('draw', (data) => {
  //     draw(data.user, data.initiator, data.drawAmount, data.emit);
  // });
  // socket.on('moveCardBundle', (data) => {
  //     moveCardBundle(data.user, data.initiator, data.oZoneId, data.dZoneId, data.index, data.targetIndex, data.action, data.emit)
  // });
  // socket.on('shuffleIntoDeck', (data) => {
  //     shuffleIntoDeck(data.user, data.initiator, data.zoneId, data.index, data.indices, data.emit);
  // });
  // socket.on('moveToDeckTop', (data) => {
  //     moveToDeckTop(data.user, data.initiator, data.oZoneId, data.index, data.emit);
  // });
  // socket.on('switchWithDeckTop', (data) => {
  //     switchWithDeckTop(data.user, data.initiator, data.oZoneId, data.index, data.emit);
  // });
  // socket.on('viewDeck', (data) => {
  //     viewDeck(data.user, data.initiator, data.viewAmount, data.top, data.selectedDeckCount, data.targetIsOpp, data.emit);
  // });
  // socket.on('shuffleAll', (data) => {
  //     shuffleAll(data.user, data.initiator, data.zoneId, data.indices, data.emit);
  // });
  // socket.on('discardAll', (data) => {
  //     discardAll(data.user, data.initiator, data.zoneId, data.emit);
  // });
  // socket.on('lostZoneAll', (data) => {
  //     lostZoneAll(data.user, data.initiator, data.zoneId, data.emit);
  // });
  // socket.on('handAll', (data) => {
  //     handAll(data.user, data.initiator, data.zoneId, data.emit);
  // });
  // socket.on('leaveAll', (data) => {
  //     leaveAll(data.user, data.initiator, data.oZoneId, data.emit);
  // });
  // socket.on('discardAndDraw', (data) => {
  //     discardAndDraw(data.user, data.initiator, data.drawAmount, data.emit);
  // });
  // socket.on('shuffleAndDraw', (data) => {
  //     shuffleAndDraw(data.user, data.initiator, data.drawAmount, data.indices, data.emit);
  // });
  // socket.on('shuffleBottomAndDraw', (data) => {
  //     shuffleBottomAndDraw(data.user, data.initiator, data.drawAmount, data.indices, data.emit);
  // });
  // socket.on('shuffleZone', (data) => {
  //     shuffleZone(data.user, data.initiator, data.zoneId, data.indices, data.message, data.emit);
  // });
  // socket.on('useAbility', (data) => {
  //     useAbility(data.user, data.initiator, data.zoneId, data.index, data.emit);
  // });
  // socket.on('removeAbilityCounter', (data) => {
  //     removeAbilityCounter(data.user, data.zoneId, data.index, data.emit);
  // });
  // socket.on('addDamageCounter', (data) => {
  //     addDamageCounter(data.user, data.zoneId, data.index, data.damageAmount, data.emit);
  // });
  // socket.on('updateDamageCounter', (data) => {
  //     updateDamageCounter(data.user, data.zoneId, data.index, data.damageAmount, data.emit);
  // });
  // socket.on('removeDamageCounter', (data) => {
  //     removeDamageCounter(data.user, data.zoneId, data.index, data.emit);
  // });
  // socket.on('addSpecialCondition', (data) => {
  //     addSpecialCondition(data.user, data.zoneId, data.index, data.emit);
  // });
  // socket.on('updateSpecialCondition', (data) => {
  //     updateSpecialCondition(data.user, data.zoneId, data.index, data.textContent, data.emit);
  // });
  // socket.on('removeSpecialCondition', (data) => {
  //     removeSpecialCondition(data.user, data.zoneId, data.index, data.emit);
  // });
  // socket.on('discardBoard', (data) => {
  //     discardBoard(data.user, data.initiator, data.message, data.emit);
  // });
  // socket.on('handBoard', (data) => {
  //     handBoard(data.user, data.initiator, data.message, data.emit);
  // });
  // socket.on('shuffleBoard', (data) => {
  //     shuffleBoard(data.user, data.initiator, data.message, data.indices, data.emit);
  // });
  // socket.on('lostZoneBoard', (data) => {
  //     lostZoneBoard(data.user, data.initiator, data.message, data.emit);
  // });
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
  // socket.on('playRandomCardFaceDown', (data) => {
  //     playRandomCardFaceDown(data.user, data.initiator, data.randomIndex, data.emit);
  // });
  // socket.on('rotateCard', (data) => {
  //     rotateCard(data.user, data.zoneId, data.index, data.single, data.emit);
  // });
  // socket.on('changeType', (data) => {
  //     changeType(data.user, data.initiator, data.zoneId, data.index, data.type, data.emit);
  // });
  // socket.on('attack', (data) => {
  //     attack(data.user, data.emit);
  // });
  // socket.on('pass', (data) => {
  //     pass(data.user, data.emit);
  // });
  // socket.on('VSTARGXFunction', (data) => {
  //     VSTARGXFunction(data.user, data.type, data.emit)
  // });
  socket.on('exportGameStateSuccessful', (key) => {
    const url = `https://ptcg-sim-meta.pages.dev/import?key=${key}`;
    appendMessage('self', url, 'announcement', false);
  });
  socket.on('exportGameStateFailed', (message) => {
    appendMessage('self', message, 'announcement', false);
  });
};

// Function to show room full modal with spectator option
function showRoomFullModal(data) {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  `;

  // Create modal content
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: linear-gradient(135deg, rgba(40, 40, 60, 0.95), rgba(60, 60, 80, 0.95));
    border: 2px solid rgba(255, 100, 100, 0.5);
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    color: #e0e0e0;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    text-align: center;
  `;

  modal.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 8px 0; color: #ff6b6b;">🚫 Room Full</h2>
      <p style="margin: 0; color: #b0b0b0;">Room "${data.roomId}" is currently full</p>
      <div style="background: rgba(255, 100, 100, 0.1); border: 1px solid rgba(255, 100, 100, 0.3); border-radius: 6px; padding: 8px; margin: 12px 0;">
        <strong>Players:</strong> ${data.playerCount}/2 | <strong>Spectators:</strong> ${data.spectatorCount}
      </div>
    </div>
    
    <p style="margin-bottom: 20px; color: #e0e0e0;">
      Would you like to join as a spectator to watch the game?
    </p>
    
    <div style="display: flex; gap: 12px; justify-content: center;">
      <button id="joinAsSpectatorBtn" style="background: rgba(100, 150, 255, 0.8); border: 1px solid rgba(100, 200, 255, 0.5); color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold;">Join as Spectator</button>
      <button id="cancelRoomFullBtn" style="background: rgba(200, 60, 60, 0.8); border: 1px solid rgba(255, 100, 100, 0.5); color: white; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold;">Cancel</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Add event listeners
  document
    .getElementById('joinAsSpectatorBtn')
    .addEventListener('click', () => {
      // Set spectator mode and rejoin
      document.getElementById('spectatorModeCheckbox').checked = true;

      // Rejoin as spectator
      socket.emit('joinGame', data.roomId, systemState.p2SelfUsername, true);

      // Remove modal
      document.body.removeChild(overlay);
    });

  document.getElementById('cancelRoomFullBtn').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}
