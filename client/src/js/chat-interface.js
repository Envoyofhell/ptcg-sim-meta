// Pokemon data imports
import { POKEMON_LOCATIONS } from '../initialization/document-event-listeners/sidebox/p2/pokemonLocations.js';
import { POKEMON_TRAINERS } from '../initialization/document-event-listeners/sidebox/p2/pokemonTrainers.js';

// Modern Chat Interface with Enhanced Features
class ChatInterface {
  constructor() {
    this.state = {
      isMinimized: true, // Start minimized
      isClosed: false,
      isDragging: false,
      isResizing: false,
      activeTab: 'battle',
      position: { x: 20, y: 20 },
      size: { width: 280, height: 350 },
      messages: {
        battle: [],
        multiplayer: [],
        logs: [],
      },
      notifications: {
        battle: 0,
        multiplayer: 0,
        logs: 0,
      },
      isConnected: false,
      roomId: null,
      playerName: null,
      players: [],
    };

    this.elements = {};
    this.dragOffset = { x: 0, y: 0 };
    this.resizeData = {
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
      direction: null,
    };

    this.init();
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.loadState();
    this.updateUI();

    // Start in minimized state
    this.minimize();
  }

  cacheElements() {
    // Main containers
    this.elements.chatContainer = document.getElementById('chatContainer');
    this.elements.chatTabClosed = document.getElementById('chatTabClosed');
    this.elements.minimizedPreview =
      document.getElementById('minimizedPreview');
    this.elements.chatHeader = document.getElementById('chatHeader');

    // Control buttons
    this.elements.minimizeBtn = document.getElementById('minimizeBtn');
    this.elements.maximizeBtn = document.getElementById('maximizeBtn');
    this.elements.closeBtn = document.getElementById('closeBtn');
    this.elements.emojiBtn = document.getElementById('emojiBtn');
    this.elements.gameOptionsBtn = document.getElementById('gameOptionsBtn');

    // Tabs
    this.elements.battleTab = document.getElementById('battleTab');
    this.elements.multiplayerTab = document.getElementById('multiplayerTab');
    this.elements.logsTab = document.getElementById('logsTab');

    // Tab content
    this.elements.battleContent = document.getElementById('battleContent');
    this.elements.multiplayerContent =
      document.getElementById('multiplayerContent');
    this.elements.logsContent = document.getElementById('logsContent');

    // Messages containers
    this.elements.battleMessages = document.getElementById('battleMessages');
    this.elements.multiplayerMessages = document.getElementById(
      'multiplayerMessages'
    );
    this.elements.logsMessages = document.getElementById('logsMessages');
    this.elements.minimizedMessages =
      document.getElementById('minimizedMessages');
    this.elements.tabMessages = document.getElementById('tabMessages');

    // Input elements
    this.elements.battleInput = document.getElementById('battleInput');
    this.elements.multiplayerInput =
      document.getElementById('multiplayerInput');
    this.elements.battleSend = document.getElementById('battleSend');
    this.elements.multiplayerSend = document.getElementById('multiplayerSend');

    // Room elements
    this.elements.playerNameInput = document.getElementById('playerNameInput');
    this.elements.roomIdInput = document.getElementById('roomIdInput');
    this.elements.joinRoomBtn = document.getElementById('joinRoomBtn');
    this.elements.generateRoomBtn = document.getElementById('generateRoomBtn');
    this.elements.leaveRoomBtn = document.getElementById('leaveRoomBtn');
    this.elements.roomJoinInterface =
      document.getElementById('roomJoinInterface');
    this.elements.roomConnectedInterface = document.getElementById(
      'roomConnectedInterface'
    );

    // Action buttons
    this.elements.battleAttackBtn = document.getElementById('battleAttackBtn');
    this.elements.battlePassBtn = document.getElementById('battlePassBtn');
    this.elements.battleUndoBtn = document.getElementById('battleUndoBtn');

    // Emoji drawer
    this.elements.emojiDrawer = document.getElementById('emojiDrawer');

    // Status elements
    this.elements.connectionStatus =
      document.getElementById('connectionStatus');
    this.elements.connectionText = document.getElementById('connectionText');
    this.elements.userCount = document.getElementById('userCount');
    this.elements.gameModeText = document.getElementById('gameModeText');

    // Notification badges
    this.elements.battleBadge = document.getElementById('battleBadge');
    this.elements.multiplayerBadge =
      document.getElementById('multiplayerBadge');
    this.elements.logsBadge = document.getElementById('logsBadge');

    // Resize handles
    this.elements.resizeHandles = document.querySelectorAll('.resize-handle');
  }

  bindEvents() {
    // Control buttons
    this.elements.minimizeBtn?.addEventListener('click', () => this.minimize());
    this.elements.maximizeBtn?.addEventListener('click', () => this.maximize());
    this.elements.closeBtn?.addEventListener('click', () => this.close());
    this.elements.emojiBtn?.addEventListener('click', () =>
      this.toggleEmojiDrawer()
    );

    // Closed tab click to reopen
    this.elements.chatTabClosed?.addEventListener('click', () => this.open());

    // Tab switching
    this.elements.battleTab?.addEventListener('click', () =>
      this.switchTab('battle')
    );
    this.elements.multiplayerTab?.addEventListener('click', () =>
      this.switchTab('multiplayer')
    );
    this.elements.logsTab?.addEventListener('click', () =>
      this.switchTab('logs')
    );

    // Message sending
    this.elements.battleSend?.addEventListener('click', () =>
      this.sendMessage('battle')
    );
    this.elements.multiplayerSend?.addEventListener('click', () =>
      this.sendMessage('multiplayer')
    );
    this.elements.battleInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage('battle');
    });
    this.elements.multiplayerInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage('multiplayer');
    });

    // Room management
    this.elements.joinRoomBtn?.addEventListener('click', () => this.joinRoom());
    this.elements.generateRoomBtn?.addEventListener('click', () =>
      this.generateRoomId()
    );
    this.elements.leaveRoomBtn?.addEventListener('click', () =>
      this.leaveRoom()
    );

    // Action buttons
    this.elements.battleAttackBtn?.addEventListener('click', () =>
      this.sendPlayerAction('attack')
    );
    this.elements.battlePassBtn?.addEventListener('click', () =>
      this.sendPlayerAction('pass')
    );
    this.elements.battleUndoBtn?.addEventListener('click', () =>
      this.sendPlayerAction('undo')
    );

    // Emoji buttons
    document.querySelectorAll('.emoji-btn').forEach((btn) => {
      btn.addEventListener('click', (e) =>
        this.insertEmoji(e.target.textContent)
      );
    });

    // Dragging
    this.elements.chatHeader?.addEventListener('mousedown', (e) =>
      this.startDrag(e)
    );

    // Resizing
    this.elements.resizeHandles?.forEach((handle) => {
      handle.addEventListener('mousedown', (e) => this.startResize(e));
    });

    // Global mouse events
    document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    document.addEventListener('mouseup', () => this.handleMouseUp());

    // Prevent context menu on resize handles
    this.elements.resizeHandles?.forEach((handle) => {
      handle.addEventListener('contextmenu', (e) => e.preventDefault());
    });

    // Window resize
    window.addEventListener('resize', () => this.constrainToViewport());
  }

  // State Management
  saveState() {
    const state = {
      isMinimized: this.state.isMinimized,
      isClosed: this.state.isClosed,
      activeTab: this.state.activeTab,
      position: this.state.position,
      size: this.state.size,
    };
    localStorage.setItem('chatInterface', JSON.stringify(state));
  }

  loadState() {
    try {
      const saved = localStorage.getItem('chatInterface');
      if (saved) {
        const state = JSON.parse(saved);
        this.state.isMinimized = state.isMinimized ?? true;
        this.state.isClosed = state.isClosed ?? false;
        this.state.activeTab = state.activeTab ?? 'battle';
        this.state.position = state.position ?? { x: 20, y: 20 };
        this.state.size = state.size ?? { width: 280, height: 350 };
      }
    } catch (e) {
      console.warn('Failed to load chat state:', e);
    }
  }

  // UI State Management
  updateUI() {
    // Update container state
    this.elements.chatContainer.classList.toggle(
      'minimized',
      this.state.isMinimized
    );
    this.elements.chatContainer.classList.toggle('closed', this.state.isClosed);

    // Update visibility
    this.elements.minimizedPreview.style.display = this.state.isMinimized
      ? 'block'
      : 'none';
    this.elements.chatTabClosed.style.display = this.state.isClosed
      ? 'block'
      : 'none';
    this.elements.chatContainer.style.display = this.state.isClosed
      ? 'none'
      : 'block';

    // Update position and size
    this.elements.chatContainer.style.left = `${this.state.position.x}px`;
    this.elements.chatContainer.style.bottom = `${this.state.position.y}px`;
    this.elements.chatContainer.style.width = `${this.state.size.width}px`;
    this.elements.chatContainer.style.height = `${this.state.size.height}px`;

    // Update active tab
    this.switchTab(this.state.activeTab);

    // Update notifications
    this.updateNotifications();

    this.saveState();
  }

  // Window Controls
  minimize() {
    this.state.isMinimized = true;
    this.updateUI();
    this.updateMinimizedPreview();
  }

  maximize() {
    this.state.isMinimized = false;
    this.updateUI();
  }

  close() {
    this.state.isClosed = true;
    this.updateUI();
    this.updateClosedTab();
  }

  open() {
    this.state.isClosed = false;
    this.state.isMinimized = false;
    this.updateUI();
  }

  // Tab Management
  switchTab(tabName) {
    this.state.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.chat-tab').forEach((tab) => {
      tab.classList.remove('active');
    });
    this.elements[`${tabName}Tab`]?.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach((content) => {
      content.classList.remove('active');
    });
    this.elements[`${tabName}Content`]?.classList.add('active');

    // Clear notifications for active tab
    this.state.notifications[tabName] = 0;
    this.updateNotifications();

    this.saveState();
  }

  // Message Management
  addMessage(tab, message) {
    this.state.messages[tab].push(message);

    // Keep only last 100 messages per tab
    if (this.state.messages[tab].length > 100) {
      this.state.messages[tab] = this.state.messages[tab].slice(-100);
    }

    // Add notification if not active tab
    if (tab !== this.state.activeTab) {
      this.state.notifications[tab]++;
    }

    this.renderMessages(tab);
    this.updateNotifications();
    this.updateMinimizedPreview();
    this.updateClosedTab();
  }

  renderMessages(tab) {
    const container = this.elements[`${tab}Messages`];
    if (!container) return;

    const messages = this.state.messages[tab];
    const messagesHtml = messages
      .map((msg) => this.formatMessage(msg))
      .join('');

    // Keep welcome message and add new messages
    const welcomeMessage = container.querySelector('.welcome-message');
    container.innerHTML = '';
    if (welcomeMessage) {
      container.appendChild(welcomeMessage);
    }
    container.insertAdjacentHTML('beforeend', messagesHtml);

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  formatMessage(message) {
    const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const typeClass = `message-${message.type}`;

    return `
            <div class="message ${typeClass}">
                <strong>${message.username}:</strong> ${message.content}
                <span class="timestamp">${timestamp}</span>
            </div>
        `;
  }

  sendMessage(tab) {
    const input = this.elements[`${tab}Input`];
    if (!input || !input.value.trim()) return;

    const message = {
      id: Date.now(),
      type: 'self',
      username: this.state.playerName || 'You',
      content: input.value.trim(),
      timestamp: Date.now(),
    };

    this.addMessage(tab, message);

    // Send to parent window
    this.sendToParent('chatMessage', { tab, message: message.content });

    input.value = '';
  }

  sendPlayerAction(action) {
    this.sendToParent('playerAction', { action });

    // Add action message
    const message = {
      id: Date.now(),
      type: 'game-action',
      username: 'System',
      content: `${this.state.playerName || 'You'} used ${action}`,
      timestamp: Date.now(),
    };

    this.addMessage('battle', message);
  }

  // Room Management
  joinRoom() {
    const playerName = this.elements.playerNameInput?.value.trim();
    const roomId = this.elements.roomIdInput?.value.trim();

    if (!playerName || !roomId) {
      alert('Please enter both player name and room ID');
      return;
    }

    const coachingMode =
      document.getElementById('coachingModeCheck')?.checked || false;
    const isSpectator =
      document.getElementById('spectatorModeCheck')?.checked || false;

    this.state.playerName = playerName;
    this.state.roomId = roomId;

    this.sendToParent('joinRoom', {
      playerName,
      roomId,
      isSpectator,
      coachingMode,
    });

    // Switch to connected interface
    this.elements.roomJoinInterface.style.display = 'none';
    this.elements.roomConnectedInterface.style.display = 'block';

    // Update connection status
    this.state.isConnected = true;
    this.updateConnectionStatus();
  }

  leaveRoom() {
    this.sendToParent('leaveRoom');

    // Switch back to join interface
    this.elements.roomJoinInterface.style.display = 'block';
    this.elements.roomConnectedInterface.style.display = 'none';

    // Reset state
    this.state.isConnected = false;
    this.state.roomId = null;
    this.state.players = [];
    this.updateConnectionStatus();
  }

  generateRoomId() {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    if (this.elements.roomIdInput) {
      this.elements.roomIdInput.value = roomId;
    }
  }

  // Dragging
  startDrag(e) {
    if (this.state.isMinimized || this.state.isClosed) return;

    this.state.isDragging = true;
    this.dragOffset.x = e.clientX - this.state.position.x;
    this.dragOffset.y =
      e.clientY - (window.innerHeight - this.state.position.y);

    this.elements.chatContainer.style.cursor = 'grabbing';
    e.preventDefault();
  }

  // Resizing
  startResize(e) {
    if (this.state.isMinimized || this.state.isClosed) return;

    this.state.isResizing = true;
    this.resizeData.direction = e.target.dataset.direction;
    this.resizeData.startX = e.clientX;
    this.resizeData.startY = e.clientY;
    this.resizeData.startWidth = this.state.size.width;
    this.resizeData.startHeight = this.state.size.height;

    e.preventDefault();
    e.stopPropagation();
  }

  handleMouseMove(e) {
    if (this.state.isDragging) {
      this.state.position.x = e.clientX - this.dragOffset.x;
      this.state.position.y =
        window.innerHeight - e.clientY + this.dragOffset.y;
      this.constrainToViewport();
      this.updateUI();
    } else if (this.state.isResizing) {
      this.handleResize(e);
    }
  }

  handleResize(e) {
    const deltaX = e.clientX - this.resizeData.startX;
    const deltaY = e.clientY - this.resizeData.startY;
    const direction = this.resizeData.direction;

    let newWidth = this.resizeData.startWidth;
    let newHeight = this.resizeData.startHeight;
    let newX = this.state.position.x;
    let newY = this.state.position.y;

    // Handle horizontal resizing
    if (direction.includes('e')) {
      newWidth = Math.max(220, this.resizeData.startWidth + deltaX);
    } else if (direction.includes('w')) {
      newWidth = Math.max(220, this.resizeData.startWidth - deltaX);
      newX = this.state.position.x + (this.resizeData.startWidth - newWidth);
    }

    // Handle vertical resizing
    if (direction.includes('s')) {
      newHeight = Math.max(180, this.resizeData.startHeight - deltaY);
      newY = this.state.position.y + (this.resizeData.startHeight - newHeight);
    } else if (direction.includes('n')) {
      newHeight = Math.max(180, this.resizeData.startHeight + deltaY);
    }

    // Apply constraints
    newWidth = Math.min(600, newWidth);
    newHeight = Math.min(800, newHeight);

    this.state.size.width = newWidth;
    this.state.size.height = newHeight;
    this.state.position.x = newX;
    this.state.position.y = newY;

    this.constrainToViewport();
    this.updateUI();
  }

  handleMouseUp() {
    if (this.state.isDragging) {
      this.state.isDragging = false;
      this.elements.chatContainer.style.cursor = '';
    }
    if (this.state.isResizing) {
      this.state.isResizing = false;
    }
  }

  constrainToViewport() {
    const maxX = window.innerWidth - this.state.size.width - 10;
    const maxY = window.innerHeight - this.state.size.height - 10;

    this.state.position.x = Math.max(10, Math.min(maxX, this.state.position.x));
    this.state.position.y = Math.max(10, Math.min(maxY, this.state.position.y));
  }

  // UI Updates
  updateNotifications() {
    Object.keys(this.state.notifications).forEach((tab) => {
      const badge = this.elements[`${tab}Badge`];
      const count = this.state.notifications[tab];

      if (badge) {
        badge.textContent = count;
        badge.classList.toggle('show', count > 0);
      }
    });
  }

  updateMinimizedPreview() {
    if (!this.elements.minimizedMessages) return;

    // Get last 3 messages from all tabs
    const allMessages = [
      ...this.state.messages.battle,
      ...this.state.messages.multiplayer,
      ...this.state.messages.logs,
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);

    const html = allMessages
      .map(
        (msg) => `
            <div class="message-preview">
                <strong>${msg.username}:</strong> ${msg.content.substring(0, 30)}${msg.content.length > 30 ? '...' : ''}
            </div>
        `
      )
      .join('');

    this.elements.minimizedMessages.innerHTML = html;
  }

  updateClosedTab() {
    if (!this.elements.tabMessages) return;

    // Get last 5 messages from all tabs
    const allMessages = [
      ...this.state.messages.battle,
      ...this.state.messages.multiplayer,
      ...this.state.messages.logs,
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);

    const html = allMessages
      .map(
        (msg) => `
            <div class="message-preview">
                ${msg.username}: ${msg.content.substring(0, 25)}${msg.content.length > 25 ? '...' : ''}
            </div>
        `
      )
      .join('');

    this.elements.tabMessages.innerHTML = html;
  }

  updateConnectionStatus() {
    if (this.elements.connectionStatus && this.elements.connectionText) {
      this.elements.connectionStatus.classList.toggle(
        'connected',
        this.state.isConnected
      );
      this.elements.connectionText.textContent = this.state.isConnected
        ? 'Online'
        : 'Offline';
    }

    if (this.elements.gameModeText) {
      this.elements.gameModeText.textContent = this.state.isConnected
        ? 'Multiplayer'
        : 'Single Player';
    }

    if (this.elements.userCount) {
      this.elements.userCount.textContent = this.state.players.length || 1;
    }
  }

  // Emoji Management
  toggleEmojiDrawer() {
    this.elements.emojiDrawer?.classList.toggle('show');
  }

  insertEmoji(emoji) {
    const activeInput = this.elements[`${this.state.activeTab}Input`];
    if (activeInput) {
      activeInput.value += emoji;
      activeInput.focus();
    }
    this.toggleEmojiDrawer();
  }

  // Parent Communication
  sendToParent(type, data) {
    if (window.parent !== window) {
      window.parent.postMessage({ type, data }, window.location.origin);
    }
  }

  // Public API for parent window
  receiveMessage(type, data) {
    switch (type) {
      case 'addMessage':
        this.addMessage(data.tab || 'battle', data.message);
        break;
      case 'updatePlayers':
        this.state.players = data.players || [];
        this.updateConnectionStatus();
        break;
      case 'connectionStatus':
        this.state.isConnected = data.connected;
        this.updateConnectionStatus();
        break;
      case 'roomJoined':
        this.state.roomId = data.roomId;
        this.state.isConnected = true;
        this.updateConnectionStatus();
        break;
      case 'roomLeft':
        this.leaveRoom();
        break;
    }
  }
}

// Initialize chat interface
const chatInterface = new ChatInterface();

// Listen for messages from parent window
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;

  const { type, data } = event.data;
  chatInterface.receiveMessage(type, data);
});

// Export for parent window access
window.chatInterface = chatInterface;
