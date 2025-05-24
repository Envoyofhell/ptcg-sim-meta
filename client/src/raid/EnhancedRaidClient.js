// ===================================================================
// File: client/src/raid/EnhancedRaidClient.js
// Path: /client/src/raid/EnhancedRaidClient.js
// Location: Enhanced client integration with server raid mechanics
// Changes: Full integration with TCGOfficialActionHandler and EnhancedRaidSocketHandler
// Dependencies: ../front-end.js, ./components/RaidGameUI.js, ./components/TurnIndicatorBar.js
// Dependents: ../front-end.js, raid-test.html
// Changelog: 
//   v1.0.0 - Enhanced client with full server integration
//   v1.0.1 - Added automatic error handling and reconnection
//   v1.0.2 - Added spectator mode and turn synchronization
// Version: 1.0.2
// ===================================================================

import { socket, systemState } from '../front-end.js';
import { RaidGameUI } from './components/RaidGameUI.js';

export class EnhancedRaidClient {
  constructor() {
    this.currentRaid = null;
    this.gameUI = null;
    this.isInRaid = false;
    this.isSpectator = false;
    this.connectionState = 'disconnected';
    this.lastGameState = null;
    this.autoReconnectTimer = null;
    this.heartbeatInterval = null;
    
    this.setupSocketListeners();
    this.startHeartbeat();
  }

  // ================ SOCKET EVENT SETUP ================

  setupSocketListeners() {
    // Connection events
    socket.on('connect', () => this.handleConnect());
    socket.on('disconnect', () => this.handleDisconnect());
    
    // Raid lifecycle events
    socket.on('raidCreated', (data) => this.handleRaidCreated(data));
    socket.on('raidJoined', (data) => this.handleRaidJoined(data));
    socket.on('raidJoinFailed', (data) => this.handleRaidJoinFailed(data));
    socket.on('raidLeft', (data) => this.handleRaidLeft(data));
    
    // Player events
    socket.on('playerJoinedRaid', (data) => this.handlePlayerJoined(data));
    socket.on('playerLeftRaid', (data) => this.handlePlayerLeft(data));
    
    // Game action events
    socket.on('raidActionResult', (data) => this.handleActionResult(data));
    socket.on('raidActionFailed', (data) => this.handleActionFailed(data));
    socket.on('gameStateUpdate', (data) => this.handleGameStateUpdate(data));
    
    // Game phase events
    socket.on('gameEnded', (data) => this.handleGameEnd(data));
    socket.on('bossActionsCompleted', (data) => this.handleBossActions(data));
    socket.on('turnEvent', (data) => this.handleTurnEvent(data));
    
    // Spectator events
    socket.on('spectatorModeChanged', (data) => this.handleSpectatorModeChange(data));
    socket.on('spectatorActionResult', (data) => this.handleSpectatorActionResult(data));
    socket.on('spectatorChatMessage', (data) => this.handleSpectatorChat(data));
    
    // Layout events
    socket.on('layoutUpdated', (data) => this.handleLayoutUpdate(data));
  }

  // ================ PUBLIC API ================

  async createRaid(config = {}) {
    const raidConfig = {
      raidId: this.generateRaidId(),
      raidType: 'tcg-official',
      maxPlayers: 4,
      minPlayers: 2,
      layout: 'versus',
      ...config
    };

    socket.emit('createRaid', raidConfig);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Raid creation timeout'));
      }, 10000);

      const handleResult = (data) => {
        clearTimeout(timeout);
        socket.off('raidCreated', handleResult);
        
        if (data.success) {
          resolve(data);
        } else {
          reject(new Error(data.error));
        }
      };

      socket.on('raidCreated', handleResult);
    });
  }

  async joinRaid(raidId, username = systemState.p2SelfUsername || 'Player') {
    const joinData = {
      raidId: raidId,
      username: username,
      deckData: systemState.selfDeckData,
      pokemon: this.generatePlayerPokemon()
    };

    socket.emit('joinRaid', joinData);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Join timeout'));
      }, 10000);

      const handleSuccess = (data) => {
        clearTimeout(timeout);
        socket.off('raidJoined', handleSuccess);
        socket.off('raidJoinFailed', handleFailed);
        resolve(data);
      };

      const handleFailed = (data) => {
        clearTimeout(timeout);
        socket.off('raidJoined', handleSuccess);
        socket.off('raidJoinFailed', handleFailed);
        reject(new Error(data.error));
      };

      socket.once('raidJoined', handleSuccess);
      socket.once('raidJoinFailed', handleFailed);
    });
  }

  sendAction(actionType, data = {}) {
    if (!this.currentRaid) {
      console.error('Cannot send action: not in a raid');
      return Promise.reject(new Error('Not in a raid'));
    }

    const action = {
      type: actionType,
      ...data
    };

    socket.emit('raidAction', {
      raidId: this.currentRaid.id,
      action: action
    });

    // Return promise for action result
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Action timeout'));
      }, 15000);

      const handleResult = (resultData) => {
        if (resultData.action.type === actionType) {
          clearTimeout(timeout);
          socket.off('raidActionResult', handleResult);
          socket.off('raidActionFailed', handleFailed);
          resolve(resultData.result);
        }
      };

      const handleFailed = (failData) => {
        if (failData.action.type === actionType) {
          clearTimeout(timeout);
          socket.off('raidActionResult', handleResult);
          socket.off('raidActionFailed', handleFailed);
          reject(new Error(failData.error));
        }
      };

      socket.on('raidActionResult', handleResult);
      socket.on('raidActionFailed', handleFailed);
    });
  }

  // ================ GAME ACTIONS ================

  async attackBoss(pokemon = 'active', attackName = 'Basic Attack', damage = 60) {
    return this.sendAction('playerAttack', {
      pokemon: pokemon,
      attackName: attackName,
      damage: damage
    });
  }

  async retreat() {
    return this.sendAction('playerRetreat');
  }

  async useCheerCard(cardNumber) {
    return this.sendAction('cheerCard', {
      cardNumber: cardNumber
    });
  }

  async testKO(pokemon = 'active') {
    return this.sendAction('testKO', {
      pokemon: pokemon
    });
  }

  async resetGame() {
    return this.sendAction('resetGame');
  }

  async joinAsSpectator() {
    return this.sendAction('joinAsSpectator');
  }

  async sendSpectatorChat(message) {
    return this.sendAction('spectatorChat', {
      message: message
    });
  }

  // ================ EVENT HANDLERS ================

  handleConnect() {
    this.connectionState = 'connected';
    console.log('🔌 Connected to raid server');
    
    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
      this.autoReconnectTimer = null;
    }

    // Request current game state if we were in a raid
    if (this.currentRaid) {
      this.requestGameState();
    }
  }

  handleDisconnect() {
    this.connectionState = 'disconnected';
    console.log('🔌 Disconnected from raid server');
    
    // Attempt to reconnect after 3 seconds
    this.autoReconnectTimer = setTimeout(() => {
      console.log('🔄 Attempting to reconnect...');
      socket.connect();
    }, 3000);
  }

  handleRaidCreated(data) {
    if (data.success) {
      console.log('🏴‍☠️ Raid created:', data.raidId);
      // Auto-join created raid
      this.joinRaid(data.raidId, systemState.p2SelfUsername || 'Host')
        .catch(err => console.error('Auto-join failed:', err));
    } else {
      console.error('Failed to create raid:', data.error);
      this.showNotification('Failed to create raid: ' + data.error, '#e74c3c');
    }
  }

  handleRaidJoined(data) {
    console.log('✅ Joined raid:', data.raidId);
    
    this.currentRaid = data.raidState;
    this.isInRaid = true;
    this.lastGameState = data.gameState;
    
    // Initialize game UI
    if (!this.gameUI) {
      this.gameUI = new RaidGameUI();
    }
    
    this.gameUI.handleRaidJoined(data);
    this.showNotification('Joined raid successfully!', '#2ecc71');
  }

  handleRaidJoinFailed(data) {
    console.error('❌ Failed to join raid:', data.error);
    this.showNotification('Failed to join raid: ' + data.error, '#e74c3c');
  }

  handlePlayerJoined(data) {
    console.log(`👋 ${data.username} joined raid (${data.playerCount}/${data.maxPlayers})`);
    
    if (this.gameUI) {
      this.gameUI.handlePlayerJoined(data);
    }
  }

  handlePlayerLeft(data) {
    console.log(`👋 Player left raid (${data.playerCount} remaining)`);
    
    if (this.gameUI) {
      this.gameUI.handlePlayerLeft(data);
    }
  }

  handleActionResult(data) {
    console.log('🎮 Action result:', data.action.type, data.result);
    
    if (this.gameUI) {
      this.gameUI.handleActionResult(data);
    }

    // Update local game state
    if (data.newState) {
      this.lastGameState = data.newState;
    }

    // Handle special results
    if (data.result.isSpectator) {
      this.isSpectator = true;
    }
  }

  handleActionFailed(data) {
    console.error('❌ Action failed:', data.action.type, data.error);
    this.showNotification(`Action failed: ${data.error}`, '#e74c3c');
  }

  handleGameStateUpdate(data) {
    this.lastGameState = data.gameState;
    
    if (this.gameUI) {
      this.gameUI.updateGameState(data.gameState);
    }
  }

  handleGameEnd(data) {
    const message = data.victory ? '🎉 Victory!' : '💀 Defeat!';
    const color = data.victory ? '#2ecc71' : '#e74c3c';
    
    console.log(message, data.reason);
    this.showNotification(`${message} ${data.reason}`, color, 5000);
    
    if (this.gameUI) {
      this.gameUI.handleGameEnd(data);
    }
  }

  handleBossActions(data) {
    console.log('👹 Boss completed actions:', data.attacks.length);
    
    if (this.gameUI) {
      this.gameUI.logAction(`Boss performed ${data.attacks.length} attacks`);
      
      // Show boss attacks with delay
      data.attacks.forEach((attack, index) => {
        setTimeout(() => {
          this.showNotification(
            `Boss used Attack ${attack.attackNumber} for ${attack.damage} damage!`, 
            '#e74c3c', 
            2000
          );
        }, index * 1000);
      });
    }
  }

  handleTurnEvent(data) {
    if (this.gameUI && this.gameUI.turnIndicator) {
      this.gameUI.turnIndicator.handleTurnUpdate(data);
    }
  }

  handleSpectatorModeChange(data) {
    this.isSpectator = data.isSpectator;
    console.log('👁️ Spectator mode:', this.isSpectator);
    
    if (this.gameUI) {
      this.gameUI.handleSpectatorModeChange(data);
    }
  }

  handleSpectatorActionResult(data) {
    console.log('👁️ Spectator action result:', data);
  }

  handleSpectatorChat(data) {
    console.log('💬 Spectator chat:', data.username, data.message);
    
    if (this.gameUI) {
      // Add to spectator chat log
      const chatLog = document.getElementById('spectatorChatLog');
      if (chatLog) {
        chatLog.innerHTML += `<div><strong>${data.username}:</strong> ${data.message}</div>`;
        chatLog.scrollTop = chatLog.scrollHeight;
      }
    }
  }

  handleLayoutUpdate(data) {
    console.log('🔄 Layout updated:', data.layout);
    
    if (this.gameUI) {
      this.gameUI.handleLayoutUpdate(data);
    }
  }

  handleRaidLeft(data) {
    this.leaveRaid();
  }

  // ================ UTILITY METHODS ================

  leaveRaid() {
    if (this.currentRaid) {
      socket.emit('leaveRaid', { raidId: this.currentRaid.id });
    }
    
    this.currentRaid = null;
    this.isInRaid = false;
    this.isSpectator = false;
    this.lastGameState = null;
    
    if (this.gameUI) {
      this.gameUI.hide();
    }
    
    console.log('👋 Left raid');
  }

  requestGameState() {
    if (this.currentRaid) {
      socket.emit('requestGameState', { raidId: this.currentRaid.id });
    }
  }

  requestTurnInfo() {
    if (this.currentRaid) {
      socket.emit('requestTurnInfo', { raidId: this.currentRaid.id });
    }
  }

  generateRaidId() {
    return 'raid-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
  }

  generatePlayerPokemon() {
    // Generate default Pokemon for testing
    return {
      active: {
        name: 'Pikachu',
        hp: 120,
        maxHP: 120,
        attacks: [
          { name: 'Thunder Shock', damage: 60 },
          { name: 'Agility', damage: 40 }
        ]
      },
      bench: {
        name: 'Squirtle',
        hp: 100,
        maxHP: 100,
        attacks: [
          { name: 'Water Gun', damage: 50 },
          { name: 'Tackle', damage: 30 }
        ]
      }
    };
  }

  showNotification(message, color = '#3498db', duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${color};
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      animation: slideInRight 0.3s ease;
      max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  startHeartbeat() {
    // Send heartbeat every 30 seconds to maintain connection
    this.heartbeatInterval = setInterval(() => {
      if (this.connectionState === 'connected' && this.currentRaid) {
        socket.emit('heartbeat', { raidId: this.currentRaid.id });
      }
    }, 30000);
  }

  // ================ TESTING UTILITIES ================

  async testFullGameFlow() {
    try {
      // Create and join raid
      const raidData = await this.createRaid({
        raidType: 'tcg-official',
        maxPlayers: 4
      });
      
      console.log('🧪 Test: Raid created and joined');
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Perform test attacks
      await this.attackBoss('active', 'Thunder Shock', 60);
      console.log('🧪 Test: Attack 1 completed');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await this.attackBoss('active', 'Thunder Shock', 60);
      console.log('🧪 Test: Attack 2 completed');
      
      // Test retreat
      await this.retreat();
      console.log('🧪 Test: Retreat completed');
      
      // Test KO
      await this.testKO('active');
      console.log('🧪 Test: KO test completed');
      
      // Test cheer card
      await this.useCheerCard(2);
      console.log('🧪 Test: Cheer card used');
      
      console.log('🧪 Full game flow test completed successfully!');
      
    } catch (error) {
      console.error('🧪 Test failed:', error);
    }
  }

  // ================ CLEANUP ================

  destroy() {
    if (this.autoReconnectTimer) {
      clearTimeout(this.autoReconnectTimer);
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.gameUI) {
      this.gameUI.destroy();
    }
    
    this.leaveRaid();
    
    console.log('🛑 Enhanced Raid Client destroyed');
  }
}

// Add required CSS for notifications
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;

if (!document.head.querySelector('[data-notification-styles]')) {
  notificationStyle.setAttribute('data-notification-styles', 'true');
  document.head.appendChild(notificationStyle);
}