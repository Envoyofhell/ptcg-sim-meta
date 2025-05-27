import { socket, systemState } from '../../front-end.js';

export const appendMessage = (user, message, type, emit = true) => {
  if (!systemState.isUndoInProgress) {
    const chatbox = document.getElementById('chatbox');
    const p2Chatbox = document.getElementById('p2Chatbox');

    const p = document.createElement('p');
    if (type === 'player') {
      p.className = user === 'self' ? 'self-text' : 'opp-text';
    } else if (type === 'message') {
      p.className = user === 'self' ? 'self-message' : 'opp-message';
    } else {
      p.className = type;
    }
    p.textContent = message;
    const chat = !systemState.isTwoPlayer ? chatbox : p2Chatbox;
    chat.appendChild(p);
    chat.scrollTop = chat.scrollHeight;

    // Also send to new chat interface (only if not already from chat interface)
    const chatInterface = document.getElementById('chatInterface');
    if (
      chatInterface &&
      chatInterface.contentWindow &&
      !message.startsWith('CHAT_INTERFACE:')
    ) {
      let chatMessageType = 'system';
      let chatTab = 'battle';
      let actionType = null;
      let playerRole = null;

      // Categorize message types
      if (type === 'player') {
        chatMessageType = user === 'self' ? 'self' : 'opponent';
        chatTab = 'battle';
        playerRole = user === 'self' ? 'Player 1' : 'Player 2';
      } else if (type === 'message') {
        chatMessageType = user === 'self' ? 'self' : 'opponent';
        chatTab = 'battle';
        playerRole = user === 'self' ? 'Player 1' : 'Player 2';
      } else if (type === 'spectator-message') {
        chatMessageType = 'spectator';
        chatTab = 'battle';
        playerRole = 'Spectator';
      } else if (type === 'announcement') {
        chatMessageType = 'system';
        chatTab = 'battle';
      } else {
        // Detect action types from message content for game actions
        chatMessageType = 'game-action';
        chatTab = 'battle';

        // Extract action type from message content
        if (message.includes('attack') || message.includes('Attack')) {
          actionType = 'attack';
        } else if (message.includes('pass') || message.includes('Pass')) {
          actionType = 'pass';
        } else if (message.includes('undo') || message.includes('took back')) {
          actionType = 'undo';
        } else if (message.includes('GX')) {
          actionType = 'gx';
        } else if (message.includes('VSTAR')) {
          actionType = 'vstar';
        } else if (message.includes('Forte')) {
          actionType = 'forte';
        } else if (message.includes('turn') || message.includes('Turn')) {
          actionType = 'turn';
        } else if (message.includes('coin') || message.includes('Coin')) {
          actionType = 'coin';
        }
      }

      // Determine color based on user and message type - Player 1 always blue, Player 2 always red
      let messageColor = 'rgba(128, 0, 128, 1)'; // Default purple for system messages
      if (type === 'player' || type === 'message') {
        messageColor =
          user === 'self' ? 'rgba(0, 123, 255, 1)' : 'rgba(255, 85, 100, 1)';
      } else if (type === 'spectator-message') {
        messageColor = 'rgba(255, 215, 0, 1)'; // Gold for spectators
      }

      // Determine username for display - get actual player names
      let displayUsername = 'System';
      if (type === 'player' || type === 'message') {
        if (user === 'self') {
          displayUsername =
            systemState.p2SelfUsername || systemState.selfUsername || 'You';
        } else {
          displayUsername =
            systemState.p2OppUsername || systemState.oppUsername || 'Opponent';
        }
      } else if (type === 'spectator-message') {
        displayUsername = 'Spectator';
      } else if (chatMessageType === 'game-action') {
        // For game actions, extract the player name from the message
        const actionMatch = message.match(
          /^(.+?)\s+(attack|pass|took back|uses|activates|starts|flips)/i
        );
        if (actionMatch) {
          displayUsername = actionMatch[1];
          // Determine if this action is from self or opponent by comparing names
          const selfName = systemState.p2SelfUsername || systemState.selfUsername;
          const oppName = systemState.p2OppUsername || systemState.oppUsername;
          
          let actionUser = 'self';
          if (displayUsername === oppName) {
            actionUser = 'opp';
          } else if (displayUsername === selfName) {
            actionUser = 'self';
          } else {
            // If we can't match the name, fall back to the original user parameter
            actionUser = user;
          }
          
          messageColor =
            actionUser === 'self'
              ? 'rgba(0, 123, 255, 1)'
              : 'rgba(255, 85, 100, 1)';
          playerRole = actionUser === 'self' ? 'Player 1' : 'Player 2';
        } else {
          displayUsername = 'Game';
        }
      }

      chatInterface.contentWindow.postMessage(
        {
          type: 'newMessage',
          data: {
            type: chatMessageType,
            content: message,
            username: displayUsername,
            timestamp: new Date().toISOString(),
            tab: chatTab,
            color: messageColor,
            playerId: null,
            action: actionType,
            role: playerRole,
          },
        },
        '*'
      );
    }

    if (systemState.isTwoPlayer && emit) {
      user = user === 'self' ? 'opp' : 'self';
      const data = {
        roomId: systemState.roomId,
        user: user,
        message: message,
        type: type,
        emit: false,
        socketId: socket.id,
      };
      socket.emit('appendMessage', data);
    }
  }
};
