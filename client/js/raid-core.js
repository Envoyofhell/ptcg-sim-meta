/* ===================================================================
 * File: client/js/raid-core.js
 * Purpose: 3D Enhanced Isolated Raid Battle System
 * Version: 3.0.0
 * Author: PTCG Sim Meta Team
 *
 * Description:
 *   Complete 3D enhanced front-end system with angled perspective gameboard,
 *   client-side layout preferences, interactive turn management,
 *   and advanced visual effects. Fully isolated from main simulator.
 *
 * Features:
 *   - 3D angled perspective rendering
 *   - Client-side layout switching (not synced to server)
 *   - Interactive turn indicator with debug controls
 *   - Enhanced player positioning algorithms
 *   - Advanced visual feedback system
 *   - Turn management with clickable controls
 * ===================================================================*/

// ================ GLOBAL RAID SYSTEM ================
window.RaidSystem = {
  // Core state management
  state: {
    isConnected: false,
    currentRaid: null,
    playerId: null,
    username: 'Player',
    layoutPreference: 'versus', // CLIENT-SIDE ONLY
    yourAngle: 0, // Player's angle in current layout
    debugMode: false,
    isInitialized: false,
    gamePhase: 'lobby',
  },

  // Socket management
  socket: null,

  // UI components
  ui: {
    launcher: null,
    container: null,
    table: null,
    controls: null,
    actions: null,
    logContainer: null,
    debugPanel: null,
    turnIndicator: null,
    playerCards: new Map(),
  },

  // Configuration
  config: {
    serverUrl: window.location.origin,
    autoConnect: true,
    debugEnabled: true,
    logMaxEntries: 100,
    reconnectAttempts: 3,
    reconnectInterval: 5000,

    // 3D rendering options
    perspective: '1000px',
    tableRotationX: '10deg',
    mobileRotationX: '8deg',
  },

  // Event system
  events: new EventTarget(),

  // Logging system
  log: {
    entries: [],
    levels: {
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
      SUCCESS: 'success',
    },
  },

  // Enhanced utilities
  utils: {
    generateRaidId: () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = 'TEST-';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    },

    adjustColor: (hex, percent) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = ((num >> 8) & 0x00ff) + amt;
      const B = (num & 0x0000ff) + amt;
      return (
        '#' +
        (
          0x1000000 +
          (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
          (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
          (B < 255 ? (B < 1 ? 0 : B) : 255)
        )
          .toString(16)
          .slice(1)
      );
    },

    formatTime: () => {
      return new Date().toLocaleTimeString();
    },

    saveLayoutPreference: (layout) => {
      localStorage.setItem('raidLayoutPreference', layout);
    },

    loadLayoutPreference: () => {
      return localStorage.getItem('raidLayoutPreference') || 'versus';
    },
  },
};

// ================ ENHANCED 3D RAID CORE ================
class Enhanced3DRaidCore {
  constructor() {
    this.initializeSystem();
  }

  initializeSystem() {
    console.log('🚀 Initializing 3D Enhanced Raid System v3.0.0...');

    // Load saved layout preference
    RaidSystem.state.layoutPreference = RaidSystem.utils.loadLayoutPreference();

    // Initialize core systems
    this.initializeLogging();
    this.initializeUI();
    this.initializeSocket();
    this.initializeEventHandlers();
    this.initializeKeyboardShortcuts();

    // Mark as initialized
    RaidSystem.state.isInitialized = true;
    this.log(
      '3D Enhanced raid system core initialized successfully',
      'SUCCESS'
    );
  }

  // ================ LOGGING SYSTEM ================
  initializeLogging() {
    RaidSystem.log.add = (message, level = 'INFO', data = null) => {
      const entry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message: message,
        data: data,
        id: Date.now() + Math.random(),
      };

      RaidSystem.log.entries.push(entry);

      // Maintain max entries
      if (RaidSystem.log.entries.length > RaidSystem.config.logMaxEntries) {
        RaidSystem.log.entries = RaidSystem.log.entries.slice(
          -RaidSystem.config.logMaxEntries
        );
      }

      // Enhanced console output with timestamps
      const consoleMsg = `[${RaidSystem.utils.formatTime()}] ${message}`;
      switch (level.toUpperCase()) {
        case 'DEBUG':
          console.debug(consoleMsg, data);
          break;
        case 'SUCCESS':
          console.log(
            `%c${consoleMsg}`,
            'color: green; font-weight: bold;',
            data
          );
          break;
        case 'WARN':
          console.warn(consoleMsg, data);
          break;
        case 'ERROR':
          console.error(consoleMsg, data);
          break;
        default:
          console.log(consoleMsg, data);
      }

      // Update UI log
      this.updateUILog();

      // Emit log event
      RaidSystem.events.dispatchEvent(
        new CustomEvent('log', { detail: entry })
      );
    };

    // Shorthand methods
    this.log = (msg, level = 'INFO', data = null) =>
      RaidSystem.log.add(msg, level, data);
  }

  // ================ UI MANAGEMENT ================
  initializeUI() {
    this.log('Initializing 3D enhanced UI management system');

    // Get UI component references
    RaidSystem.ui = {
      launcher: document.getElementById('raidLauncher'),
      container: document.getElementById('raidContainer'),
      table: document.getElementById('raidTable'),
      controls: document.getElementById('raidControls'),
      actions: document.getElementById('gameActions'),
      logContainer: document.getElementById('gameLogContainer'),
      logContent: document.getElementById('gameLogContent'),
      debugPanel: document.getElementById('debugPanel'),

      // Boss elements
      bossDisplay: document.getElementById('raidBossDisplay'),
      bossHPFill: document.querySelector('.boss-hp-fill'),
      bossHPText: document.getElementById('bossHPDisplay'),
      bossName: document.getElementById('bossNameDisplay'),

      // Turn indicator
      turnIndicator: document.getElementById('turnIndicatorContainer'),
      layoutIndicator: document.getElementById('layoutIndicatorGfx'),

      // Status elements
      connectionStatus: document.getElementById('connectionStatusDisplay'),
      statusLog: document.getElementById('raidStatusLog'),

      // Player cards
      playerCards: new Map(),
    };

    // Initialize view management
    this.initializeViewManagement();

    // Initialize chat system
    this.initializeChatSystem();

    // Update layout UI
    this.updateLayoutUI();
  }

  initializeViewManagement() {
    // Enhanced view switching with 3D transitions
    RaidSystem.ui.switchView = (viewName) => {
      this.log(`Switching to view: ${viewName}`);

      const launcher = RaidSystem.ui.launcher;
      const container = RaidSystem.ui.container;
      const controls = RaidSystem.ui.controls;
      const actions = RaidSystem.ui.actions;
      const logContainer = RaidSystem.ui.logContainer;

      // Hide all views with fade effect
      [launcher, container, controls, actions, logContainer].forEach((el) => {
        if (el) el.style.display = 'none';
      });

      // Hide chat toggle by default
      if (RaidSystem.ui.chat?.toggleBtn) {
        RaidSystem.ui.chat.toggleBtn.style.display = 'none';
      }

      // Show target view
      if (viewName === 'launcher') {
        if (launcher) launcher.style.display = 'block';
      } else if (viewName === 'game') {
        if (container) container.style.display = 'block';
        if (controls) controls.style.display = 'block';
        if (actions) actions.style.display = 'flex';
        if (logContainer) logContainer.style.display = 'block';

        // Show chat toggle in game
        if (RaidSystem.ui.chat?.toggleBtn) {
          RaidSystem.ui.chat.toggleBtn.style.display = 'block';
        }
      }

      // Hide/show communication panel toggle
      if (RaidSystem.ui.comm?.toggleBtn) {
        RaidSystem.ui.comm.toggleBtn.style.display =
          viewName === 'game' ? 'block' : 'none';
      }
      if (RaidSystem.ui.comm?.oldToggleBtn) {
        RaidSystem.ui.comm.oldToggleBtn.style.display =
          viewName === 'game' ? 'block' : 'none';
      }
    };

    // Initialize in launcher view
    RaidSystem.ui.switchView('launcher');
  }

  initializeChatSystem() {
    this.log('Initializing unified communication system...');

    // Get communication UI references
    RaidSystem.ui.comm = {
      panel: document.getElementById('commPanel'),
      toggleBtn: document.getElementById('commToggleBtn'),
      oldToggleBtn: document.getElementById('chatToggleBtn'), // Keep old one for compatibility
      closeBtn: document.getElementById('closeCommBtn'),

      // Tabs
      chatTab: document.getElementById('chatTab'),
      gameLogTab: document.getElementById('gameLogTab'),

      // Tab contents
      chatTabContent: document.getElementById('chatTabContent'),
      gameLogTabContent: document.getElementById('gameLogTabContent'),

      // Messages areas
      chatMessages: document.getElementById('chatMessages'),
      gameLogMessages: document.getElementById('gameLogContent'),

      // Input
      chatInput: document.getElementById('chatInput'),
      sendBtn: document.getElementById('sendChatBtn'),
      exportBtn: document.getElementById('exportLogBtn'),
    };

    // Communication state
    RaidSystem.state.comm = {
      isOpen: false,
      activeTab: 'chat',
      chatMessages: [],
      gameLogMessages: [],
      maxMessages: 100,
    };

    // Setup communication events
    if (RaidSystem.ui.comm.toggleBtn) {
      RaidSystem.ui.comm.toggleBtn.addEventListener('click', () =>
        this.toggleCommPanel()
      );
    }

    if (RaidSystem.ui.comm.oldToggleBtn) {
      RaidSystem.ui.comm.oldToggleBtn.addEventListener('click', () =>
        this.toggleCommPanel()
      );
    }

    if (RaidSystem.ui.comm.closeBtn) {
      RaidSystem.ui.comm.closeBtn.addEventListener('click', () =>
        this.toggleCommPanel()
      );
    }

    if (RaidSystem.ui.comm.sendBtn) {
      RaidSystem.ui.comm.sendBtn.addEventListener('click', () =>
        this.sendChatMessage()
      );
    }

    if (RaidSystem.ui.comm.chatInput) {
      RaidSystem.ui.comm.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.sendChatMessage();
        }
      });
    }

    // Tab switching
    if (RaidSystem.ui.comm.chatTab) {
      RaidSystem.ui.comm.chatTab.addEventListener('click', () =>
        this.switchCommTab('chat')
      );
    }

    if (RaidSystem.ui.comm.gameLogTab) {
      RaidSystem.ui.comm.gameLogTab.addEventListener('click', () =>
        this.switchCommTab('game-log')
      );
    }

    if (RaidSystem.ui.comm.exportBtn) {
      RaidSystem.ui.comm.exportBtn.addEventListener('click', () =>
        this.exportGameLog()
      );
    }

    // Communication management methods
    RaidSystem.ui.addChatMessage = (message, isOwn = false) => {
      this.addCommMessage(message, 'chat', isOwn);
    };

    RaidSystem.ui.addGameLogMessage = (message, level = 'info') => {
      this.addCommMessage(message, 'game-log', false, level);
    };
  }

  switchCommTab(tabName) {
    RaidSystem.state.comm.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.comm-tab').forEach((tab) => {
      tab.classList.remove('active');
    });

    document.querySelectorAll('.comm-tab-content').forEach((content) => {
      content.classList.remove('active');
    });

    // Activate selected tab
    if (tabName === 'chat') {
      RaidSystem.ui.comm.chatTab?.classList.add('active');
      RaidSystem.ui.comm.chatTabContent?.classList.add('active');
    } else if (tabName === 'game-log') {
      RaidSystem.ui.comm.gameLogTab?.classList.add('active');
      RaidSystem.ui.comm.gameLogTabContent?.classList.add('active');
    }

    this.log(`Switched to ${tabName} tab`);
  }

  addCommMessage(message, type = 'chat', isOwn = false, level = 'info') {
    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    let targetContainer;
    let messageClass = 'comm-message';
    let formattedMessage;

    if (type === 'chat') {
      targetContainer = RaidSystem.ui.comm.chatMessages;
      messageClass += ' chat';
      if (isOwn) messageClass += ' own';
      formattedMessage = `<span style="color: #95a5a6; font-size: 10px;">[${timestamp}]</span> ${message}`;

      // Store in chat messages
      RaidSystem.state.comm.chatMessages.push({
        message,
        isOwn,
        timestamp: Date.now(),
      });

      // Limit messages
      if (
        RaidSystem.state.comm.chatMessages.length >
        RaidSystem.state.comm.maxMessages
      ) {
        RaidSystem.state.comm.chatMessages =
          RaidSystem.state.comm.chatMessages.slice(
            -RaidSystem.state.comm.maxMessages
          );
      }
    } else if (type === 'game-log') {
      targetContainer = RaidSystem.ui.comm.gameLogMessages;
      messageClass += ` game-log ${level}`;
      formattedMessage = `<span style="color: #95a5a6; font-size: 10px;">[${timestamp}]</span> ${message}`;

      // Store in game log messages
      RaidSystem.state.comm.gameLogMessages.push({
        message,
        level,
        timestamp: Date.now(),
      });

      // Limit messages
      if (
        RaidSystem.state.comm.gameLogMessages.length >
        RaidSystem.state.comm.maxMessages
      ) {
        RaidSystem.state.comm.gameLogMessages =
          RaidSystem.state.comm.gameLogMessages.slice(
            -RaidSystem.state.comm.maxMessages
          );
      }
    }

    if (targetContainer) {
      const messageEl = document.createElement('div');
      messageEl.className = messageClass;
      messageEl.innerHTML = formattedMessage;

      targetContainer.appendChild(messageEl);
      targetContainer.scrollTop = targetContainer.scrollHeight;
    }
  }

  toggleCommPanel() {
    if (!RaidSystem.ui.comm.panel) return;

    RaidSystem.state.comm.isOpen = !RaidSystem.state.comm.isOpen;
    RaidSystem.ui.comm.panel.style.display = RaidSystem.state.comm.isOpen
      ? 'block'
      : 'none';

    if (RaidSystem.state.comm.isOpen) {
      RaidSystem.ui.comm.chatInput?.focus();
      this.log('Communication panel opened');
    } else {
      this.log('Communication panel closed');
    }
  }

  // ================ SOCKET MANAGEMENT ================
  initializeSocket() {
    this.log('Initializing socket connection...');

    RaidSystem.socket = io();

    // Connection events
    RaidSystem.socket.on('connect', () => {
      RaidSystem.state.isConnected = true;
      RaidSystem.state.playerId = RaidSystem.socket.id;
      this.updateConnectionStatus('Connected', 'success');
      this.log(
        `Connected to server with ID: ${RaidSystem.state.playerId}`,
        'SUCCESS'
      );
    });

    RaidSystem.socket.on('disconnect', () => {
      RaidSystem.state.isConnected = false;
      this.updateConnectionStatus('Disconnected', 'error');
      this.log('Disconnected from server', 'WARN');
    });

    RaidSystem.socket.on('connect_error', (error) => {
      this.updateConnectionStatus('Connection Error', 'error');
      this.log('Connection error', 'ERROR', error);
    });

    // Setup raid-specific socket events
    this.setupRaidSocketEvents();
  }

  setupRaidSocketEvents() {
    // Raid creation and joining
    RaidSystem.socket.on('raidCreated', (data) => {
      this.log('Raid created successfully!', 'SUCCESS');
      this.handleRaidCreated(data);
    });

    RaidSystem.socket.on('raidJoined', (data) => {
      this.log('Successfully joined raid!', 'SUCCESS');
      this.handleRaidJoined(data);
    });

    RaidSystem.socket.on('playerJoinedRaid', (data) => {
      this.log(`Player ${data.player?.username || 'Unknown'} joined raid`);
      this.handlePlayerJoined(data);
    });

    RaidSystem.socket.on('playerLeftRaid', (data) => {
      this.log(`Player left raid`);
      this.handlePlayerLeft(data);
    });

    // Game state and actions
    RaidSystem.socket.on('raidActionResult', (data) => {
      this.log(`Action result: ${data.message}`);
      this.handleActionResult(data);
    });

    RaidSystem.socket.on('gameStateUpdate', (data) => {
      this.log('Game state updated');
      this.handleGameStateUpdate(data);
    });

    // Layout events (server-side, but we use client-side preference)
    RaidSystem.socket.on('layoutSwitched', (data) => {
      this.log('Raid layout switched');
      this.handleLayoutSwitched(data);
    });

    // Error handling
    RaidSystem.socket.on('raidCreationFailed', (data) => {
      this.log(`Failed to create raid: ${data.message}`, 'ERROR');
    });

    RaidSystem.socket.on('raidJoinFailed', (data) => {
      this.log(`Failed to join raid: ${data.message}`, 'ERROR');
    });

    RaidSystem.socket.on('raidActionFailed', (data) => {
      this.log(`Action failed: ${data.error}`, 'ERROR');
    });

    // Chat events
    RaidSystem.socket.on('chatMessage', (data) => {
      this.handleChatMessage(data);
    });
  }

  // ================ EVENT HANDLERS ================
  initializeEventHandlers() {
    this.log('Setting up 3D event handlers...');

    // Launcher controls
    this.setupElement('createRaidBtn', () => this.createRaid());
    this.setupElement('joinRaidBtn', () => this.joinRaid());
    this.setupElement('testMultiplayerBtn', () => this.testMultiplayer());
    this.setupElement('quickTestBtn', () => this.quickTest());

    // Layout controls (CLIENT-SIDE)
    this.setupElement('launcherToggleLayoutBtn', () =>
      this.toggleClientLayout()
    );
    this.setupElement('controlsSwitchLayoutBtn', () =>
      this.toggleClientLayout()
    );

    // Game actions
    this.setupElement('attackBtn', () => this.sendAttack());
    this.setupElement('testKOBtn', () => this.sendTestKO());
    this.setupElement('leaveRaidBtn', () => this.leaveRaid());

    // Debug controls
    this.setupElement('toggleDebugPanelBtn', () => this.toggleDebugPanel());
    this.setupElement('closeDebugBtn', () => this.toggleDebugPanel());

    // Global debug controls
    this.setupElement('debugSkipTurnBtn', () => this.debugSkipTurn());
    this.setupElement('debugForceBossTurnBtn', () => this.debugForceBossTurn());
    this.setupElement('debugResetRaidBtn', () => this.debugResetRaid());
    this.setupElement('debugStartGameBtn', () => this.debugStartGame());

    // Log controls
    this.setupElement('exportLogBtn', () => this.exportGameLog());

    // Boss control system
    this.setupBossControlSystem();

    // Check for URL parameters
    this.checkURLParameters();
  }

  setupElement(id, handler) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', handler);
    }
  }

  initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Debug panel toggle: Shift+F12
      if (e.shiftKey && e.key === 'F12') {
        e.preventDefault();
        this.toggleDebugPanel();
      }

      // Layout toggle: Ctrl+L
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        this.toggleClientLayout();
      }

      // Quick attack: Space (when in game)
      if (e.key === ' ' && RaidSystem.state.currentRaid) {
        e.preventDefault();
        this.sendAttack();
      }
    });
  }

  checkURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const raidId = urlParams.get('raid');
    const username = urlParams.get('username');
    const autoJoin = urlParams.get('join');

    if (raidId && autoJoin === 'auto') {
      this.log(`Auto-joining raid: ${raidId}`, 'INFO');

      setTimeout(() => {
        if (username) {
          const usernameInput = document.getElementById('usernameInput');
          if (usernameInput) usernameInput.value = username;
          RaidSystem.state.username = username;
        }

        const raidInput = document.getElementById('raidIdInput');
        if (raidInput) {
          raidInput.value = raidId;
          this.joinRaid();
        }
      }, 1000);
    }
  }

  // ================ CLIENT-SIDE LAYOUT MANAGEMENT ================
  toggleClientLayout() {
    const oldLayout = RaidSystem.state.layoutPreference;
    RaidSystem.state.layoutPreference =
      oldLayout === 'versus' ? 'circular' : 'versus';

    // Save preference
    RaidSystem.utils.saveLayoutPreference(RaidSystem.state.layoutPreference);

    this.log(`Switching raid layout to: ${RaidSystem.state.layoutPreference}`);

    // Update UI
    this.updateLayoutUI();

    // Re-render if in game
    if (RaidSystem.state.currentRaid) {
      this.renderRaidState();
    }
  }

  updateLayoutUI() {
    const elements = [
      'launcherCurrentLayoutSpan',
      'controlLayoutDisplay',
      'layoutNameDisplay',
    ];

    elements.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = RaidSystem.state.layoutPreference;
      }
    });
  }

  // ================ 3D RENDERING SYSTEM ================
  renderRaidState() {
    if (!RaidSystem.state.currentRaid) return;

    this.log(
      `Rendering raid table with layout: ${RaidSystem.state.layoutPreference}`
    );

    // Render all components
    this.renderRaidTable();
    this.renderPlayerCards();
    this.renderBossDisplay();
    this.renderTurnIndicator();
    this.updateRaidInfo();
    this.updateDebugInfo();

    // Update boss control display if active
    if (
      document.getElementById('bossControlOverlay')?.style.display === 'block'
    ) {
      this.updateBossControlDisplay();
    }
  }

  renderRaidTable() {
    const table = RaidSystem.ui.table;
    if (!table) return;

    // Apply 3D perspective with client layout
    table.className = `raid-table layout-${RaidSystem.state.layoutPreference}`;

    this.log(`Applied ${RaidSystem.state.layoutPreference} layout styling`);

    // Update layout indicator
    const indicator = RaidSystem.ui.layoutIndicator;
    if (indicator) {
      indicator.className = `layout-indicator-gfx layout-${RaidSystem.state.layoutPreference}`;
    }
  }

  renderPlayerCards() {
    if (!RaidSystem.state.currentRaid?.players) return;

    this.log(
      `Rendering ${RaidSystem.state.currentRaid.players.length} player cards`
    );

    // Clear existing cards
    this.clearPlayerCards();

    // Calculate positions based on CLIENT layout preference
    const positions = this.calculatePlayerPositions();

    // Create new cards
    RaidSystem.state.currentRaid.players.forEach((player, index) => {
      const position = positions[index];
      if (!position) return;

      const card = this.createPlayerCard(player, position, index);
      if (RaidSystem.ui.table) {
        RaidSystem.ui.table.appendChild(card);
      }
    });
  }

  calculatePlayerPositions() {
    const playerCount = RaidSystem.state.currentRaid.players.length;
    const positions = [];

    if (RaidSystem.state.layoutPreference === 'versus') {
      // Versus Layout: Players positioned on bottom side (15-165 degrees)
      // Boss is at top, so players should be at bottom
      const startAngle = 195; // Bottom-left
      const endAngle = 345; // Bottom-right (avoid direct bottom where UI elements are)
      const angleStep =
        playerCount > 1 ? (endAngle - startAngle) / (playerCount - 1) : 0;

      for (let i = 0; i < playerCount; i++) {
        const angle = playerCount === 1 ? 270 : startAngle + angleStep * i; // 270 = bottom center for single player
        const radians = (angle * Math.PI) / 180;
        const radius = 38; // Distance from center - increased to avoid overlap

        // Track current player's angle
        if (
          RaidSystem.state.currentRaid.players[i].id ===
          RaidSystem.state.playerId
        ) {
          RaidSystem.state.yourAngle = Math.round(angle);
        }

        positions.push({
          angle: angle,
          x: 50 + radius * Math.cos(radians),
          y: 50 - radius * Math.sin(radians), // Negative because Y increases downward
        });
      }
    } else {
      // Circular Layout: Players evenly distributed around circle
      const angleStep = 360 / playerCount;
      const radius = 32; // Distance from center

      for (let i = 0; i < playerCount; i++) {
        const angle = i * angleStep;
        const radians = (angle * Math.PI) / 180;

        // Track current player's angle
        if (
          RaidSystem.state.currentRaid.players[i].id ===
          RaidSystem.state.playerId
        ) {
          RaidSystem.state.yourAngle = Math.round(angle);
        }

        positions.push({
          angle: angle,
          x: 50 + radius * Math.cos(radians),
          y: 50 - radius * Math.sin(radians),
        });
      }
    }

    return positions;
  }

  createPlayerCard(player, position, index) {
    const card = document.createElement('div');
    card.className = 'raid-player-card';
    card.id = `player-card-${player.id}`;

    // Position the card
    card.style.left = `${position.x}%`;
    card.style.top = `${position.y}%`;
    card.style.transform = 'translate(-50%, -50%)';

    // Set player color
    const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12'];
    const playerColor = colors[index % colors.length];
    const darkerColor = RaidSystem.utils.adjustColor(playerColor, -20);
    card.style.background = `linear-gradient(45deg, ${playerColor}, ${darkerColor})`;

    // Current player highlighting
    if (RaidSystem.state.currentRaid.currentTurnPlayerId === player.id) {
      card.classList.add('current-player');
    }

    // KO status
    if (player.status === 'ko') {
      card.classList.add('ko');
    }

    // Calculate HP percentage
    const hpPercentage =
      (player.activePokemon.currentHP / player.activePokemon.maxHP) * 100;

    // Card content
    card.innerHTML = `
      <div class="player-name">${player.username}</div>
      <div class="player-hp-bar">
        <div class="player-hp-fill" style="width: ${hpPercentage}%;"></div>
      </div>
      <div class="player-angle-display">${Math.round(position.angle)}°</div>
    `;

    // Store card reference
    RaidSystem.ui.playerCards.set(player.id, card);

    return card;
  }

  clearPlayerCards() {
    // Remove all existing player cards
    const existingCards = document.querySelectorAll('.raid-player-card');
    existingCards.forEach((card) => card.remove());

    // Clear card references
    RaidSystem.ui.playerCards.clear();
  }

  renderBossDisplay() {
    const boss = RaidSystem.state.currentRaid?.boss;
    if (!boss) return;

    // Debug logging
    this.log(
      `🎯 Rendering boss: ${boss.name} - HP: ${boss.currentHP}/${boss.maxHP}`,
      'DEBUG'
    );

    // Update boss info
    if (RaidSystem.ui.bossName) {
      RaidSystem.ui.bossName.textContent = boss.name;
    }

    if (RaidSystem.ui.bossHPText) {
      RaidSystem.ui.bossHPText.textContent = `HP: ${boss.currentHP} / ${boss.maxHP}`;
    }

    // Update HP bar
    if (RaidSystem.ui.bossHPFill) {
      const percentage = (boss.currentHP / boss.maxHP) * 100;
      RaidSystem.ui.bossHPFill.style.width = `${percentage}%`;

      // Debug logging for HP bar
      this.log(`🎯 Boss HP bar updated: ${percentage.toFixed(1)}%`, 'DEBUG');

      // Dynamic color based on HP
      if (percentage > 60) {
        RaidSystem.ui.bossHPFill.style.background =
          'linear-gradient(90deg, #c0392b, #e74c3c)';
      } else if (percentage > 30) {
        RaidSystem.ui.bossHPFill.style.background =
          'linear-gradient(90deg, #f39c12, #e67e22)';
      } else {
        RaidSystem.ui.bossHPFill.style.background =
          'linear-gradient(90deg, #e74c3c, #c0392b)';
      }
    }
  }

  renderTurnIndicator() {
    const container = RaidSystem.ui.turnIndicator;
    const turnData = RaidSystem.state.currentRaid?.turnIndicator;

    if (!container || !turnData?.elements) {
      if (container) container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = '';

    // Create turn elements
    turnData.elements.forEach((element, index) => {
      const turnEl = document.createElement('div');
      turnEl.className = `turn-indicator-element ${element.status} ${element.type}`;

      // Visual styling
      if (element.status === 'current') {
        turnEl.style.background = '#f39c12';
        turnEl.style.color = '#333';
      } else if (element.type === 'boss') {
        turnEl.style.background = '#e74c3c';
        turnEl.style.color = 'white';
      } else {
        turnEl.style.background = 'rgba(255, 255, 255, 0.1)';
        turnEl.style.color = 'white';
      }

      // Content
      turnEl.innerHTML = `
        <span>${element.type === 'boss' ? '👹' : '👤'}</span>
        <span>${element.username || element.name}</span>
      `;

      // Debug mode: make interactive
      if (RaidSystem.state.debugMode) {
        turnEl.style.cursor = 'pointer';
        turnEl.title = `Debug: Click to force turn (${element.username || element.name})`;
        turnEl.addEventListener('click', () => {
          this.log(
            `Debug: Forcing turn to ${element.username || element.name}`
          );
          this.sendRaidAction('forceNextTurn', {});
        });
      }

      container.appendChild(turnEl);
    });
  }

  // ================ RAID ACTIONS ================
  createRaid() {
    const raidId = RaidSystem.utils.generateRaidId();
    this.log(`Creating raid: ${raidId}`);

    RaidSystem.socket.emit('createRaid', {
      raidId: raidId,
      raidType: 'tcg-official',
      maxPlayers: 4,
      minPlayers: 1,
      layout: 'versus', // Server layout (ignored by client rendering)
    });
  }

  joinRaid() {
    const raidId = document.getElementById('raidIdInput')?.value?.trim();
    const username =
      document.getElementById('usernameInput')?.value?.trim() || 'Player';

    if (!raidId) {
      this.log('Please enter a raid ID', 'ERROR');
      return;
    }

    RaidSystem.state.username = username;
    this.log(`Joining raid: ${raidId} as ${username}`);

    RaidSystem.socket.emit('joinRaid', {
      raidId: raidId,
      playerData: {
        username: username,
        activePokemon: {
          name: 'Pikachu',
          maxHP: 120,
          attacks: [{ name: 'Thunder Shock', damage: 60 }],
        },
      },
    });
  }

  testMultiplayer() {
    const raidId = RaidSystem.utils.generateRaidId();
    this.log(`Creating multiplayer test: ${raidId}`);

    const testUrl = `${window.location.origin}/raid-isolated.html?raid=${raidId}&username=Envoy&join=auto`;

    // Copy to clipboard
    navigator.clipboard
      .writeText(testUrl)
      .then(() => {
        this.log('Test URL copied to clipboard!', 'SUCCESS');
      })
      .catch(() => {
        this.log(`Test URL: ${testUrl}`);
      });

    // Create the raid
    RaidSystem.socket.emit('createRaid', {
      raidId: raidId,
      raidType: 'tcg-official',
      maxPlayers: 4,
      layout: 'circular',
    });
  }

  quickTest() {
    const raidId = RaidSystem.utils.generateRaidId();
    this.log(`Starting quick test: ${raidId}`);

    RaidSystem.socket.emit('createRaid', {
      raidId: raidId,
      raidType: 'tcg-official',
      maxPlayers: 4,
      layout: 'versus',
    });
  }

  sendAttack() {
    if (!RaidSystem.state.currentRaid) return;

    this.log('Sending action: playerAttack');
    this.sendRaidAction('playerAttack', {
      damage: 60,
      attackName: 'Thunder Shock',
    });
  }

  sendTestKO() {
    if (!RaidSystem.state.currentRaid) return;

    this.log('Sending action: testKO');
    this.sendRaidAction('testKO', {
      pokemon: 'active',
    });
  }

  sendRaidAction(actionType, actionData = {}) {
    if (!RaidSystem.socket || !RaidSystem.state.currentRaid) return;

    RaidSystem.socket.emit('raidAction', {
      raidId: RaidSystem.state.currentRaid.id,
      action: {
        type: actionType,
        ...actionData,
      },
    });
  }

  leaveRaid() {
    if (!RaidSystem.state.currentRaid) return;

    RaidSystem.socket.emit('leaveRaid', {
      raidId: RaidSystem.state.currentRaid.id,
    });

    RaidSystem.state.currentRaid = null;
    RaidSystem.ui.switchView('launcher');
    this.log('Left raid');
  }

  // ================ EVENT HANDLERS ================
  handleRaidCreated(data) {
    RaidSystem.state.currentRaid = data.raidState;
    RaidSystem.state.playerId = data.playerId;
    RaidSystem.ui.switchView('game');
    this.renderRaidState();
  }

  handleRaidJoined(data) {
    RaidSystem.state.currentRaid = data.raidState;
    RaidSystem.state.playerId = data.playerId;
    RaidSystem.ui.switchView('game');
    this.renderRaidState();
  }

  handlePlayerJoined(data) {
    RaidSystem.state.currentRaid = data.updatedRaidState;
    this.renderRaidState();
  }

  handlePlayerLeft(data) {
    if (data.updatedRaidState) {
      RaidSystem.state.currentRaid = data.updatedRaidState;
      this.renderRaidState();
    }
  }

  handleActionResult(data) {
    // Enhanced logging for debugging
    this.log(`🔥 Action result received:`, 'DEBUG');
    this.log(`  Action: ${data.actionType}`, 'DEBUG');
    this.log(`  Message: ${data.message}`, 'DEBUG');
    this.log(`  Player: ${data.playerId}`, 'DEBUG');

    if (data.actionType === 'playerAttack') {
      const oldBoss = RaidSystem.state.currentRaid?.boss;
      const newBoss = data.updatedRaidState?.boss;

      if (oldBoss && newBoss) {
        this.log(
          `  🎯 Boss HP Change: ${oldBoss.currentHP} → ${newBoss.currentHP}`,
          'DEBUG'
        );
        this.log(
          `  💥 Damage Applied: ${oldBoss.currentHP - newBoss.currentHP}`,
          'DEBUG'
        );
      }
    }

    RaidSystem.state.currentRaid = data.updatedRaidState;
    this.renderRaidState();
    this.showActionFeedback(data.message, data.actionType);
  }

  handleGameStateUpdate(data) {
    RaidSystem.state.currentRaid = data.raidState;
    this.renderRaidState();
  }

  handleLayoutSwitched(data) {
    // Server layout switched, but we maintain client preference
    RaidSystem.state.currentRaid = data.updatedRaidState;
    this.renderRaidState(); // Re-render with client layout
  }

  showActionFeedback(message, actionType) {
    this.log(`Action feedback: ${message}`);
    // Future: Add visual feedback animations
  }

  // ================ UI UPDATES ================
  updateConnectionStatus(status, type = 'info') {
    if (RaidSystem.ui.connectionStatus) {
      RaidSystem.ui.connectionStatus.textContent = status;
      RaidSystem.ui.connectionStatus.className = type;
    }
  }

  updateRaidInfo() {
    if (!RaidSystem.state.currentRaid) return;

    this.log(
      `Raid info updated - ${RaidSystem.state.currentRaid.players.length} players`
    );

    const updates = {
      controlRaidId: RaidSystem.state.currentRaid.id,
      controlPlayerCount: `${RaidSystem.state.currentRaid.players.length}/${RaidSystem.state.currentRaid.config.maxPlayers}`,
      controlLayoutDisplay: RaidSystem.state.layoutPreference,
      controlYourAngle: `${RaidSystem.state.yourAngle}`,
      controlRaidPhase: RaidSystem.state.currentRaid.gamePhase,
    };

    Object.entries(updates).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });
  }

  updateUILog() {
    if (!RaidSystem.ui.comm?.gameLogMessages) return;

    // Show recent entries (newest at bottom, like normal chat)
    const recentEntries = RaidSystem.log.entries.slice(-50);

    // Clear and rebuild the game log
    RaidSystem.ui.comm.gameLogMessages.innerHTML = '';

    recentEntries.forEach((entry) => {
      const levelClass = entry.level.toLowerCase();
      const timestamp = entry.timestamp.split('T')[1].split('.')[0];
      RaidSystem.ui.addGameLogMessage(`${entry.message}`, levelClass);
    });
  }

  // ================ DEBUG SYSTEM ================
  toggleDebugPanel() {
    const panel = RaidSystem.ui.debugPanel;
    if (!panel) return;

    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      // Enabling debug mode
      RaidSystem.state.debugMode = true;
      this.updateDebugInfo();
      this.renderTurnIndicator(); // Re-render with debug functionality

      // Sync debug mode with server if in a raid
      if (RaidSystem.state.currentRaid) {
        this.sendRaidAction('toggleDebugMode', {});
      }

      this.log('Debug mode enabled', 'DEBUG');
    } else {
      // Disabling debug mode
      RaidSystem.state.debugMode = false;
      this.renderTurnIndicator(); // Re-render without debug functionality

      // Sync debug mode with server if in a raid (only if it was enabled)
      if (RaidSystem.state.currentRaid) {
        this.sendRaidAction('toggleDebugMode', {});
      }

      this.log('Debug mode disabled', 'DEBUG');
    }
  }

  updateDebugInfo() {
    const stateEl = document.getElementById('debugClientCoreState');
    const raidEl = document.getElementById('debugLastRaidState');
    const errorsEl = document.getElementById('debugRecentErrors');

    if (stateEl) {
      stateEl.textContent = JSON.stringify(
        {
          isConnected: RaidSystem.state.isConnected,
          currentRaid: RaidSystem.state.currentRaid
            ? {
                id: RaidSystem.state.currentRaid.id,
                players: RaidSystem.state.currentRaid.players?.length || 0,
                gamePhase: RaidSystem.state.currentRaid.gamePhase,
              }
            : null,
          playerId: RaidSystem.state.playerId,
          username: RaidSystem.state.username,
          layoutPreference: RaidSystem.state.layoutPreference,
          yourAngle: RaidSystem.state.yourAngle,
          debugMode: RaidSystem.state.debugMode,
          isInitialized: RaidSystem.state.isInitialized,
        },
        null,
        2
      );
    }

    if (raidEl) {
      raidEl.textContent = JSON.stringify(
        RaidSystem.state.currentRaid,
        null,
        2
      );
    }

    if (errorsEl) {
      const errors = RaidSystem.log.entries
        .filter((e) => e.level === 'ERROR')
        .slice(-10);
      errorsEl.textContent = JSON.stringify(errors, null, 2);
    }

    // Update player control buttons
    this.updatePlayerControlButtons();
  }

  updatePlayerControlButtons() {
    const container = document.getElementById('playerControlButtons');
    if (!container || !RaidSystem.state.currentRaid) return;

    container.innerHTML = '';

    // Generate buttons for each player
    RaidSystem.state.currentRaid.players.forEach((player) => {
      const playerDiv = document.createElement('div');
      playerDiv.style.cssText =
        'margin: 5px 0; padding: 5px; background: rgba(255,255,255,0.1); border-radius: 5px;';

      const playerName = document.createElement('div');
      playerName.style.cssText =
        'font-size: 11px; margin-bottom: 3px; color: #f39c12;';
      playerName.textContent = `${player.username} (${player.status})`;

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'debug-buttons';

      // Resurrect button
      const resurrectBtn = document.createElement('button');
      resurrectBtn.className = 'debug-player-btn resurrect';
      resurrectBtn.textContent = '♻️ Resurrect';
      resurrectBtn.onclick = () => this.debugResurrectPlayer(player.id);

      // Kill active button
      const killActiveBtn = document.createElement('button');
      killActiveBtn.className = 'debug-player-btn kill';
      killActiveBtn.textContent = '💀 KO Active';
      killActiveBtn.onclick = () => this.debugKillPlayer(player.id, 'active');

      // Kill bench button
      const killBenchBtn = document.createElement('button');
      killBenchBtn.className = 'debug-player-btn kill';
      killBenchBtn.textContent = '💀 KO Bench';
      killBenchBtn.onclick = () => this.debugKillPlayer(player.id, 'bench');

      // Set HP button
      const setHPBtn = document.createElement('button');
      setHPBtn.className = 'debug-player-btn';
      setHPBtn.textContent = '❤️ Set HP';
      setHPBtn.onclick = () => this.debugSetPlayerHP(player.id);

      // Heal button
      const healBtn = document.createElement('button');
      healBtn.className = 'debug-player-btn resurrect';
      healBtn.textContent = '💚 Heal 50';
      healBtn.onclick = () => this.debugHealPlayer(player.id, 'active', 50);

      buttonContainer.appendChild(resurrectBtn);
      buttonContainer.appendChild(killActiveBtn);
      buttonContainer.appendChild(killBenchBtn);
      buttonContainer.appendChild(setHPBtn);
      buttonContainer.appendChild(healBtn);

      playerDiv.appendChild(playerName);
      playerDiv.appendChild(buttonContainer);
      container.appendChild(playerDiv);
    });
  }

  debugResurrectPlayer(playerId) {
    this.log(`Debug: Resurrecting player ${playerId}`, 'DEBUG');
    this.sendRaidAction('debugResurrectPlayer', { playerId });
  }

  debugKillPlayer(playerId, pokemon) {
    this.log(
      `Debug: Killing ${pokemon} Pokemon of player ${playerId}`,
      'DEBUG'
    );
    this.sendRaidAction('debugKillPlayer', { playerId, pokemon });
  }

  debugSetPlayerHP(playerId) {
    const newHP = prompt('Enter new HP for active Pokemon:', '120');
    if (newHP && !isNaN(parseInt(newHP))) {
      this.log(`Debug: Setting player ${playerId} HP to ${newHP}`, 'DEBUG');
      this.sendRaidAction('debugSetHP', {
        target: `player-${playerId}`,
        value: parseInt(newHP),
      });
    }
  }

  debugHealPlayer(playerId, pokemon, amount) {
    this.log(
      `Debug: Healing ${pokemon} Pokemon of player ${playerId} by ${amount} HP`,
      'DEBUG'
    );
    this.sendRaidAction('debugHealPlayer', {
      playerId: playerId,
      pokemon: pokemon,
      amount: amount,
    });
  }

  debugSkipTurn() {
    this.log('Debug: Skipping turn', 'DEBUG');
    this.sendRaidAction('debugSkipTurn', {});
  }

  debugResetRaid() {
    this.log('Debug: Resetting raid', 'DEBUG');
    this.sendRaidAction('debugResetRaid', {});
  }

  debugForceBossTurn() {
    this.log('Debug: Forcing boss turn', 'DEBUG');
    this.sendRaidAction('debugForceBossTurn', {});
  }

  debugStartGame() {
    this.log('Debug: Starting game', 'DEBUG');
    this.sendRaidAction('debugStartGame', {});
  }

  setupBossControlSystem() {
    // Boss control toggle
    this.setupElement('bossControlCheckbox', () => this.toggleBossControl());
    this.setupElement('closeBossControlBtn', () => this.closeBossControl());

    // Boss HP controls
    this.setupElement('setBossHPBtn', () => this.setBossHP());
    this.setupElement('healBossBtn', () => this.healBoss());

    // Boss attack buttons
    const attackButtons = document.querySelectorAll('.boss-attack-btn');
    attackButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const attackType = button.getAttribute('data-attack');
        this.executeBossAttack(attackType);
      });
    });
  }

  toggleBossControl() {
    const checkbox = document.getElementById('bossControlCheckbox');
    const overlay = document.getElementById('bossControlOverlay');

    if (checkbox && overlay) {
      if (checkbox.checked) {
        overlay.style.display = 'block';
        this.updateBossControlDisplay();
        this.log('Boss control mode enabled', 'DEBUG');
      } else {
        overlay.style.display = 'none';
        this.log('Boss control mode disabled', 'DEBUG');
      }
    }
  }

  closeBossControl() {
    const checkbox = document.getElementById('bossControlCheckbox');
    const overlay = document.getElementById('bossControlOverlay');

    if (checkbox) checkbox.checked = false;
    if (overlay) overlay.style.display = 'none';
    this.log('Boss control closed', 'DEBUG');
  }

  updateBossControlDisplay() {
    if (!RaidSystem.state.currentRaid) return;

    // Update boss HP display
    const bossHPDisplay = document.getElementById('bossControlCurrentHP');
    const boss = RaidSystem.state.currentRaid.boss;
    if (bossHPDisplay && boss) {
      bossHPDisplay.textContent = `${boss.currentHP}/${boss.maxHP}`;
    }

    // Update target buttons
    this.updateBossTargetButtons();
  }

  updateBossTargetButtons() {
    const container = document.getElementById('bossTargetButtons');
    if (!container || !RaidSystem.state.currentRaid) return;

    container.innerHTML = '';

    // Add target buttons for each active player
    RaidSystem.state.currentRaid.players.forEach((player) => {
      if (player.status === 'active') {
        const button = document.createElement('button');
        button.className = 'boss-attack-btn';
        button.innerHTML = `🎯 ${player.username}<br><small>HP: ${player.activePokemon.currentHP}/${player.activePokemon.maxHP}</small>`;
        button.onclick = () => this.setBossTarget(player.id);
        container.appendChild(button);
      }
    });
  }

  setBossTarget(playerId) {
    RaidSystem.state.bossTarget = playerId;
    const player = RaidSystem.state.currentRaid.players.find(
      (p) => p.id === playerId
    );
    this.log(`Boss target set to: ${player?.username || 'Unknown'}`, 'DEBUG');
  }

  setBossHP() {
    const input = document.getElementById('bossHPInput');
    if (!input || !RaidSystem.state.currentRaid) return;

    const newHP = parseInt(input.value);
    if (isNaN(newHP) || newHP < 0) {
      this.log('Invalid HP value', 'ERROR');
      return;
    }

    this.log(`Setting boss HP to: ${newHP}`, 'DEBUG');

    this.sendRaidAction('debugSetHP', {
      target: 'boss',
      value: newHP,
    });
  }

  healBoss() {
    if (!RaidSystem.state.currentRaid) return;

    this.log('Healing boss to full HP', 'DEBUG');

    this.sendRaidAction('debugSetHP', {
      target: 'boss',
      value: RaidSystem.state.currentRaid.boss.maxHP,
    });
  }

  executeBossAttack(attackType) {
    if (!RaidSystem.state.currentRaid || !RaidSystem.state.bossTarget) {
      this.log('No target selected for boss attack', 'ERROR');
      return;
    }

    let damage = 60;
    let attackName = 'Boss Attack';

    switch (attackType) {
      case 'slash':
        damage = 30;
        attackName = 'Slash';
        break;
      case 'megaPunch':
        damage = 60;
        attackName = 'Mega Punch';
        break;
      case 'hyperBeam':
        damage = 100;
        attackName = 'Hyper Beam';
        break;
      case 'custom':
        const customDamage = prompt('Enter custom damage amount:', '50');
        if (customDamage && !isNaN(parseInt(customDamage))) {
          damage = parseInt(customDamage);
          attackName = 'Custom Attack';
        } else {
          return;
        }
        break;
    }

    const targetPlayer = RaidSystem.state.currentRaid.players.find(
      (p) => p.id === RaidSystem.state.bossTarget
    );
    this.log(
      `Boss using ${attackName} on ${targetPlayer?.username || 'Unknown'} for ${damage} damage`,
      'DEBUG'
    );

    this.sendRaidAction('bossAttack', {
      target: RaidSystem.state.bossTarget,
      attackName: attackName,
      damage: damage,
    });
  }

  exportGameLog() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const raidId = RaidSystem.state.currentRaid?.id || 'unknown-raid';
    const filename = `raid-log-${raidId}-${timestamp}.txt`;

    // Format log entries
    const logText = RaidSystem.log.entries
      .map((entry) => {
        const time = entry.timestamp.split('T')[1].split('.')[0];
        return `[${time}] [${entry.level}] ${entry.message}`;
      })
      .join('\n');

    // Create download
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);

    this.log(`Game log exported as: ${filename}`, 'SUCCESS');
  }

  handleChatMessage(data) {
    const isOwn = data.playerId === RaidSystem.state.playerId;
    const username = data.username || 'Unknown';
    const message = data.message || '';

    if (data.type === 'system') {
      // System messages go to both chat and game log
      RaidSystem.ui.addChatMessage(message, false);
      RaidSystem.ui.addGameLogMessage(`SYSTEM: ${message}`, 'info');
    } else {
      // Player messages go to chat tab
      const displayMessage = isOwn
        ? `<strong>You:</strong> ${message}`
        : `<strong>${username}:</strong> ${message}`;

      RaidSystem.ui.addChatMessage(displayMessage, isOwn);

      // Add a note to game log
      RaidSystem.ui.addGameLogMessage(
        `💬 Chat: ${username}: ${message}`,
        'debug'
      );
    }

    this.log(`Chat received: ${username}: ${message}`, 'DEBUG');
  }

  sendChatMessage() {
    const input = RaidSystem.ui.comm?.chatInput;
    if (!input || !input.value.trim()) return;

    const message = input.value.trim();
    input.value = '';

    // Send to server if in raid
    if (RaidSystem.state.currentRaid && RaidSystem.socket) {
      RaidSystem.socket.emit('chatMessage', {
        raidId: RaidSystem.state.currentRaid.id,
        message: message,
        username: RaidSystem.state.username,
      });
    }

    // Add to local chat (will be echoed from server)
    this.log(`Chat sent: ${message}`, 'DEBUG');
  }
}

// ================ AUTO-INITIALIZATION ================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize the enhanced 3D raid system
    window.RaidSystem.core = new Enhanced3DRaidCore();
    window.RaidSystem.initialized = true;

    console.log('✅ 3D Enhanced Raid System fully initialized and ready!');
  } catch (error) {
    console.error('❌ Failed to initialize 3D Enhanced Raid System:', error);
  }
});

/* ===================================================================
 * END OF FILE: client/js/raid-core.js
 *
 * Enhanced raid system with:
 * - Player card rendering and positioning
 * - Visual action feedback and damage effects
 * - Improved layout switching
 * - Better multiplayer synchronization
 * - Enhanced boss display with dynamic HP colors
 * - Real-time player updates
 * ===================================================================*/
