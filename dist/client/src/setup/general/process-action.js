// File: client/src/setup/general/process-action.js
/**
 * Action Processing
 *
 * Handles all game actions and their propagation through
 * the system with enhanced error handling and offline support.
 */
import { socket, systemState } from '../../front-end.js';

/**
 * Process a game action and store it in the appropriate places
 *
 * @param {string} user - 'self' or 'opp'
 * @param {boolean} emit - Whether to emit the action via socket
 * @param {string} action - Action type
 * @param {Array} parameters - Action parameters
 */
export const processAction = (user, emit, action, parameters) => {
  // Initialize arrays if they don't exist to prevent errors
  if (!systemState.actionData) {
    systemState.actionData = {
      self: [],
      opponent: [],
      spectator: [],
    };
  }

  if (!Array.isArray(systemState.actionData.self)) {
    systemState.actionData.self = [];
  }

  if (!Array.isArray(systemState.actionData.opponent)) {
    systemState.actionData.opponent = [];
  }

  if (!Array.isArray(systemState.exportActionData)) {
    systemState.exportActionData = [];
  }

  // Store the action in the proper place based on user
  if (user === 'self') {
    systemState.actionData.self.push({
      emit: emit,
      action: action,
      parameters: parameters,
    });

    if (emit && action !== 'loadDeckData' && action !== 'exchangeData') {
      systemState.exportActionData.push({
        user: user,
        emit: emit,
        action: action,
        parameters: parameters,
      });
    }
  } else {
    systemState.actionData.opponent.push({
      emit: emit,
      action: action,
      parameters: parameters,
    });

    if (
      emit &&
      action !== 'loadDeckData' &&
      action !== 'exchangeData' &&
      !systemState.isUndoInProgress
    ) {
      systemState.exportActionData.push({
        user: user,
        emit: emit,
        action: action,
        parameters: parameters,
      });
    }
  }

  // Only emit if socket exists and is connected
  if (emit && socket) {
    try {
      // Check if we are in two-player mode and the socket is connected
      if (socket.connected && systemState.isTwoPlayer) {
        const data = {
          roomId: systemState.roomId,
          counter: systemState.selfCounter,
          action: action,
          parameters: parameters,
        };
        socket.emit('requestAction', data);
        systemState.selfCounter++;
      } else {
        // We're in offline mode - log action but don't try to send it
        console.log(`[Socket-Offline] Action processed locally: ${action}`);
      }
    } catch (error) {
      console.error(`[Socket] Error emitting action: ${error.message}`);
    }
  }
};
