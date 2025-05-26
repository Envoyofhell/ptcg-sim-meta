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

    // Also send to new chat interface
    const chatInterface = document.getElementById('chatInterface');
    if (chatInterface && chatInterface.contentWindow) {
      let chatMessageType = 'system';
      let chatTab = 'main';

      if (type === 'player') {
        chatMessageType = user === 'self' ? 'self' : 'opponent';
        chatTab = 'all'; // Show in both main and chat tabs
      } else if (type === 'message') {
        chatMessageType = user === 'self' ? 'self' : 'opponent';
        chatTab = 'all'; // Show in both main and chat tabs
      } else if (type === 'spectator-message') {
        chatMessageType = 'spectator';
        chatTab = 'all';
      } else {
        chatMessageType = 'game-action';
        chatTab = 'main'; // Game actions only in main tab
      }

      chatInterface.contentWindow.postMessage(
        {
          type: 'newMessage',
          data: {
            type: chatMessageType,
            content: message,
            username: user === 'self' ? 'You' : 'Opponent',
            timestamp: new Date().toISOString(),
            tab: chatTab,
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
