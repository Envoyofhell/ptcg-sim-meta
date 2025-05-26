// Enhanced MMO-Style Chat Interface
class ChatInterface {
  constructor() {
    this.currentTab = 'main';
    this.isMinimized = false;
    this.messageCount = { main: 0, chat: 0, logs: 0 };
    this.emojiDrawerOpen = false;

    this.initializeElements();
    this.bindEvents();
    this.setupParentCommunication();
    this.initializeInterface();
  }

  initializeElements() {
    // Tab elements
    this.tabs = document.querySelectorAll('.chat-tab');
    this.tabContents = document.querySelectorAll('.tab-content');

    // Message containers
    this.mainMessages = document.getElementById('mainMessages');
    this.chatMessages = document.getElementById('chatMessages');
    this.logsMessages = document.getElementById('logsMessages');

    // Input elements
    this.mainInput = document.getElementById('mainInput');
    this.chatInput = document.getElementById('chatInput');
    this.mainSend = document.getElementById('mainSend');
    this.chatSend = document.getElementById('chatSend');

    // Control elements
    this.emojiBtn = document.getElementById('emojiBtn');
    this.minimizeBtn = document.getElementById('minimizeBtn');
    this.settingsBtn = document.getElementById('settingsBtn');
    this.emojiDrawer = document.getElementById('emojiDrawer');

    // Action buttons
    this.mainAttackBtn = document.getElementById('mainAttackBtn');
    this.mainPassBtn = document.getElementById('mainPassBtn');
    this.mainUndoBtn = document.getElementById('mainUndoBtn');

    // Status elements
    this.connectionStatus = document.getElementById('connectionStatus');
    this.connectionText = document.getElementById('connectionText');
    this.userCount = document.getElementById('userCount');
    this.gameModeText = document.getElementById('gameModeText');

    // Logs controls
    this.clearLogs = document.getElementById('clearLogs');
    this.exportLogs = document.getElementById('exportLogs');

    // Notification badges
    this.badges = {
      main: document.getElementById('mainBadge'),
      chat: document.getElementById('chatBadge'),
      logs: document.getElementById('logsBadge'),
    };

    // Emoji buttons
    this.emojiButtons = document.querySelectorAll('.emoji-btn');
  }

  bindEvents() {
    // Tab switching
    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Message sending
    this.mainSend.addEventListener('click', () => this.sendMessage('main'));
    this.chatSend.addEventListener('click', () => this.sendMessage('chat'));

    // Enter key for sending messages
    this.mainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage('main');
    });
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage('chat');
    });

    // Control buttons
    this.emojiBtn.addEventListener('click', () => this.toggleEmojiDrawer());
    this.minimizeBtn.addEventListener('click', () => this.toggleMinimize());
    this.settingsBtn.addEventListener('click', () => this.openSettings());

    // Action buttons
    this.mainAttackBtn.addEventListener('click', () =>
      this.sendAction('attack')
    );
    this.mainPassBtn.addEventListener('click', () => this.sendAction('pass'));
    this.mainUndoBtn.addEventListener('click', () => this.sendAction('undo'));

    // Emoji selection
    this.emojiButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.insertEmoji(btn.textContent));
    });

    // Logs controls
    this.clearLogs.addEventListener('click', () => this.clearGameLogs());
    this.exportLogs.addEventListener('click', () => this.exportGameLogs());

    // Click outside to close emoji drawer
    document.addEventListener('click', (e) => {
      if (
        !this.emojiDrawer.contains(e.target) &&
        !this.emojiBtn.contains(e.target)
      ) {
        this.closeEmojiDrawer();
      }
    });
  }

  setupParentCommunication() {
    // Listen for messages from parent window
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;

      const { type, data } = event.data;

      switch (type) {
        case 'newMessage':
          this.addMessage(data);
          break;
        case 'gameAction':
          this.addGameAction(data);
          break;
        case 'updateStatus':
          this.updateStatus(data);
          break;
        case 'updateUserCount':
          this.updateUserCount(data.count);
          break;
        case 'updateGameMode':
          this.updateGameMode(data.mode);
          break;
        case 'clearChat':
          this.clearMessages(data.tab || 'all');
          break;
      }
    });
  }

  initializeInterface() {
    this.switchTab('main');
    this.updateStatus({ connected: true, text: 'Connected' });
    this.addWelcomeMessage();
  }

  switchTab(tabName) {
    // Update active tab
    this.tabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update active content
    this.tabContents.forEach((content) => {
      content.classList.toggle('active', content.id === `${tabName}Content`);
    });

    this.currentTab = tabName;

    // Clear notification badge for current tab
    this.clearNotificationBadge(tabName);

    // Scroll to bottom of current tab
    this.scrollToBottom(tabName);
  }

  sendMessage(type) {
    const input = type === 'main' ? this.mainInput : this.chatInput;
    const message = input.value.trim();

    if (!message) return;

    // Send to parent window
    window.parent.postMessage(
      {
        type: 'chatMessage',
        data: {
          message,
          messageType: type,
          timestamp: new Date().toISOString(),
        },
      },
      '*'
    );

    // Add to local chat
    this.addMessage({
      type: 'self',
      content: message,
      username: 'You',
      timestamp: new Date(),
      tab: type === 'main' ? 'main' : 'chat',
    });

    input.value = '';
  }

  sendAction(action) {
    // Send action to parent window
    window.parent.postMessage(
      {
        type: 'gameAction',
        data: {
          action,
          timestamp: new Date().toISOString(),
        },
      },
      '*'
    );

    // Add action message to main and logs
    this.addGameAction({
      action,
      player: 'self',
      timestamp: new Date(),
    });
  }

  addMessage(data) {
    const { type, content, username, timestamp, tab = 'main' } = data;

    const messageElement = this.createMessageElement({
      type,
      content,
      username,
      timestamp: new Date(timestamp),
    });

    // Add to appropriate containers
    if (tab === 'main' || tab === 'all') {
      this.mainMessages.appendChild(messageElement.cloneNode(true));
      this.updateNotificationBadge('main');
    }

    if (tab === 'chat' || tab === 'all') {
      this.chatMessages.appendChild(messageElement.cloneNode(true));
      this.updateNotificationBadge('chat');
    }

    this.scrollToBottom(tab);
  }

  addGameAction(data) {
    const { action, player, timestamp, details } = data;

    let actionText = '';
    switch (action) {
      case 'attack':
        actionText = `${player === 'self' ? 'You' : 'Opponent'} declared an attack`;
        break;
      case 'pass':
        actionText = `${player === 'self' ? 'You' : 'Opponent'} passed the turn`;
        break;
      case 'undo':
        actionText = `${player === 'self' ? 'You' : 'Opponent'} undid the last action`;
        break;
      case 'draw':
        actionText = `${player === 'self' ? 'You' : 'Opponent'} drew ${details?.count || 1} card(s)`;
        break;
      case 'play':
        actionText = `${player === 'self' ? 'You' : 'Opponent'} played ${details?.card || 'a card'}`;
        break;
      default:
        actionText = `${player === 'self' ? 'You' : 'Opponent'} performed ${action}`;
    }

    const gameMessage = this.createMessageElement({
      type: 'game-action',
      content: actionText,
      timestamp: new Date(timestamp),
    });

    // Add to main and logs
    this.mainMessages.appendChild(gameMessage.cloneNode(true));
    this.logsMessages.appendChild(gameMessage.cloneNode(true));

    this.updateNotificationBadge('main');
    this.updateNotificationBadge('logs');

    this.scrollToBottom('main');
    this.scrollToBottom('logs');
  }

  createMessageElement(data) {
    const { type, content, username, timestamp } = data;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    // Create player icon
    const iconDiv = document.createElement('div');
    iconDiv.className = 'message-icon';
    
    // Set icon content based on message type
    if (type === 'self') {
      iconDiv.textContent = 'P1';
    } else if (type === 'opponent') {
      iconDiv.textContent = 'P2';
    } else if (type === 'spectator') {
      iconDiv.textContent = 'S';
    } else if (type === 'game-action') {
      iconDiv.textContent = '⚡';
    } else {
      iconDiv.textContent = '●';
    }

    // Create message body container
    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'message-body';

    if (username && type !== 'game-action') {
      const headerDiv = document.createElement('div');
      headerDiv.className = 'message-header';

      const usernameSpan = document.createElement('span');
      usernameSpan.className = 'message-username';
      usernameSpan.textContent = username;

      const timestampSpan = document.createElement('span');
      timestampSpan.className = 'message-timestamp';
      timestampSpan.textContent = this.formatTime(timestamp);

      headerDiv.appendChild(usernameSpan);
      headerDiv.appendChild(timestampSpan);
      bodyDiv.appendChild(headerDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    bodyDiv.appendChild(contentDiv);

    // Add icon and body to message
    messageDiv.appendChild(iconDiv);
    messageDiv.appendChild(bodyDiv);

    return messageDiv;
  }

  toggleEmojiDrawer() {
    this.emojiDrawerOpen = !this.emojiDrawerOpen;
    this.emojiDrawer.classList.toggle('show', this.emojiDrawerOpen);
  }

  closeEmojiDrawer() {
    this.emojiDrawerOpen = false;
    this.emojiDrawer.classList.remove('show');
  }

  insertEmoji(emoji) {
    const activeInput =
      this.currentTab === 'main' ? this.mainInput : this.chatInput;
    const currentValue = activeInput.value;
    const cursorPos = activeInput.selectionStart;

    const newValue =
      currentValue.slice(0, cursorPos) + emoji + currentValue.slice(cursorPos);
    activeInput.value = newValue;
    activeInput.focus();
    activeInput.setSelectionRange(
      cursorPos + emoji.length,
      cursorPos + emoji.length
    );

    this.closeEmojiDrawer();
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    document
      .querySelector('.chat-container')
      .classList.toggle('minimized', this.isMinimized);

    // Update minimize button icon
    const icon = this.minimizeBtn.querySelector('.icon');
    if (this.isMinimized) {
      icon.innerHTML = '<path d="M19 13H5v-2h14v2z"/>';
    } else {
      icon.innerHTML = '<path d="M19 13H5v-2h14v2z"/>';
    }
  }

  openSettings() {
    // Send settings request to parent
    window.parent.postMessage(
      {
        type: 'openChatSettings',
      },
      '*'
    );
  }

  updateNotificationBadge(tab) {
    if (tab === this.currentTab) return;

    this.messageCount[tab]++;
    const badge = this.badges[tab];

    if (badge) {
      badge.textContent = this.messageCount[tab];
      badge.classList.add('show');
    }
  }

  clearNotificationBadge(tab) {
    this.messageCount[tab] = 0;
    const badge = this.badges[tab];

    if (badge) {
      badge.classList.remove('show');
    }
  }

  updateStatus(data) {
    const { connected, text } = data;

    this.connectionStatus.className = `status-indicator ${connected ? 'online' : 'offline'}`;
    this.connectionText.textContent =
      text || (connected ? 'Connected' : 'Disconnected');
  }

  updateUserCount(count) {
    this.userCount.textContent = count;
  }

  updateGameMode(mode) {
    this.gameModeText.textContent = mode;
  }

  clearMessages(tab) {
    if (tab === 'all') {
      this.mainMessages.innerHTML = '';
      this.chatMessages.innerHTML = '';
      this.logsMessages.innerHTML = '';
      this.addWelcomeMessage();
    } else {
      const container = document.getElementById(`${tab}Messages`);
      if (container) {
        container.innerHTML = '';
        if (tab === 'main') this.addWelcomeMessage();
      }
    }
  }

  clearGameLogs() {
    this.logsMessages.innerHTML = '';
    this.addMessage({
      type: 'system',
      content: 'Game logs cleared.',
      timestamp: new Date(),
      tab: 'logs',
    });
  }

  exportGameLogs() {
    const logs = Array.from(this.logsMessages.children)
      .map((msg) => {
        const timestamp =
          msg.querySelector('.message-timestamp')?.textContent || '';
        const content =
          msg.querySelector('.message-content')?.textContent || '';
        return `[${timestamp}] ${content}`;
      })
      .join('\n');

    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ptcg-game-logs-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  scrollToBottom(tab) {
    const container = document.getElementById(`${tab}Messages`);
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  addWelcomeMessage() {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
            <div class="system-message">
                <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>Welcome to Meta PTCG-sim! Enhanced MMO-style chat interface ready.</span>
            </div>
        `;

    this.mainMessages.appendChild(welcomeDiv);
  }
}

// Initialize chat interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.chatInterface = new ChatInterface();
});

// Export for parent window access
window.ChatInterface = ChatInterface;
