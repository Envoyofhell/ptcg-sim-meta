// ===================================================================
// File: client/src/raid/components/RaidGameUI.js
// Path: /client/src/raid/components/RaidGameUI.js
// Location: Client-side game UI for testing TCG raid mechanics
// Changes: Initial implementation of test interface
// Dependencies: TurnIndicatorBar.js, ../RaidClient.js, ../../front-end.js
// Dependents: raid-test.html, ../../front-end.js
// Changelog: 
//   v1.0.0 - Initial test UI with damage buttons and HP bars
//   v1.0.1 - Added turn management and win/loss notifications
//   v1.0.2 - Added spectator mode UI and cheer card testing
// Version: 1.0.2
// ===================================================================

import { socket } from '../../front-end.js';
import { TurnIndicatorBar } from './TurnIndicatorBar.js';

export class RaidGameUI {
  constructor() {
    this.gameState = null;
    this.isSpectator = false;
    this.turnIndicator = null;
    this.myPlayerId = socket.id;
    
    this.setupEventListeners();
    this.createGameInterface();
  }

  // ================ INITIALIZATION ================

  setupEventListeners() {
    // Game state updates
    socket.on('raidJoined', (data) => this.handleRaidJoined(data));
    socket.on('raidActionResult', (data) => this.handleActionResult(data));
    socket.on('gameStateUpdate', (data) => this.updateGameState(data));
    socket.on('spectatorModeChanged', (data) => this.handleSpectatorModeChange(data));
    socket.on('gameEnded', (data) => this.handleGameEnd(data));
  }

  createGameInterface() {
    // Create main game container
    const gameContainer = document.createElement('div');
    gameContainer.id = 'raidGameUI';
    gameContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
      display: none;
      flex-direction: column;
      z-index: 2000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // Turn indicator at top
    const turnIndicatorContainer = document.createElement('div');
    turnIndicatorContainer.id = 'turnIndicatorContainer';
    turnIndicatorContainer.style.cssText = `
      padding: 15px 20px;
      background: rgba(0,0,0,0.2);
      backdrop-filter: blur(10px);
    `;

    // Main game area
    const gameArea = document.createElement('div');
    gameArea.className = 'game-area';
    gameArea.style.cssText = `
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 2fr 1fr;
      grid-template-rows: 1fr 1fr;
      gap: 20px;
      padding: 20px;
    `;

    // Player panels
    const playerPanel = this.createPlayerPanel();
    const bossPanel = this.createBossPanel();
    const actionsPanel = this.createActionsPanel();
    const statusPanel = this.createStatusPanel();
    const spectatorPanel = this.createSpectatorPanel();

    // Layout the panels
    gameArea.appendChild(playerPanel);
    gameArea.appendChild(bossPanel);
    gameArea.appendChild(actionsPanel);
    gameArea.appendChild(statusPanel);
    gameArea.appendChild(spectatorPanel);

    gameContainer.appendChild(turnIndicatorContainer);
    gameContainer.appendChild(gameArea);
    
    document.body.appendChild(gameContainer);

    // Initialize turn indicator
    this.turnIndicator = new TurnIndicatorBar('turnIndicatorContainer');
    
    this.gameContainer = gameContainer;
    this.gameArea = gameArea;
  }

  // ================ PANEL CREATION ================

  createPlayerPanel() {
    const panel = document.createElement('div');
    panel.className = 'player-panel';
    panel.style.cssText = `
      background: rgba(52, 152, 219, 0.1);
      border-radius: 15px;
      padding: 20px;
      border: 2px solid rgba(52, 152, 219, 0.3);
      grid-column: 1;
      grid-row: 1 / 3;
    `;

    panel.innerHTML = `
      <h3 style="color: #3498db; margin-top: 0;">Your Pokemon</h3>
      
      <div class="pokemon-container">
        <div class="active-pokemon">
          <h4 style="color: #ecf0f1;">Active Pokemon</h4>
          <div class="pokemon-card" id="activeCard">
            <div class="pokemon-name">Loading...</div>
            <div class="hp-bar-container">
              <div class="hp-bar">
                <div class="hp-fill" id="activeHP"></div>
              </div>
              <div class="hp-text" id="activeHPText">0/0</div>
            </div>
            <div class="pokemon-attacks" id="activeAttacks"></div>
          </div>
        </div>

        <div class="bench-pokemon" style="margin-top: 20px;">
          <h4 style="color: #ecf0f1;">Bench Pokemon</h4>
          <div class="pokemon-card" id="benchCard">
            <div class="pokemon-name">Loading...</div>
            <div class="hp-bar-container">
              <div class="hp-bar">
                <div class="hp-fill" id="benchHP"></div>
              </div>
              <div class="hp-text" id="benchHPText">0/0</div>
            </div>
            <div class="pokemon-attacks" id="benchAttacks"></div>
          </div>
        </div>

        <button id="retreatBtn" class="action-button retreat-btn" style="margin-top: 15px;">
          Retreat (Swap Active/Bench)
        </button>
      </div>
    `;

    return panel;
  }

  createBossPanel() {
    const panel = document.createElement('div');
    panel.className = 'boss-panel';
    panel.style.cssText = `
      background: rgba(231, 76, 60, 0.1);
      border-radius: 15px;
      padding: 20px;
      border: 2px solid rgba(231, 76, 60, 0.3);
      grid-column: 2;
      grid-row: 1 / 3;
      text-align: center;
    `;

    panel.innerHTML = `
      <h3 style="color: #e74c3c; margin-top: 0;">Raid Boss</h3>
      
      <div class="boss-card">
        <div class="boss-name" id="bossName">Mysterious Boss</div>
        <div class="boss-level" id="bossLevel">Level ?</div>
        
        <div class="boss-hp-container" style="margin: 20px 0;">
          <div class="boss-hp-bar">
            <div class="boss-hp-fill" id="bossHP"></div>
          </div>
          <div class="boss-hp-text" id="bossHPText">0/0</div>
        </div>

        <div class="boss-stats">
          <div class="stat">Attacks Per Turn: <span id="bossAttacks">0</span></div>
          <div class="stat">Current Attacks: <span id="currentAttacks">0</span></div>
        </div>

        <div class="boss-status" id="bossStatus" style="margin-top: 15px;">
          Waiting for game to start...
        </div>
      </div>
    `;

    return panel;
  }

  createActionsPanel() {
    const panel = document.createElement('div');
    panel.className = 'actions-panel';
    panel.style.cssText = `
      background: rgba(46, 204, 113, 0.1);
      border-radius: 15px;
      padding: 20px;
      border: 2px solid rgba(46, 204, 113, 0.3);
      grid-column: 3;
      grid-row: 1;
    `;

    panel.innerHTML = `
      <h3 style="color: #2ecc71; margin-top: 0;">Actions</h3>
      
      <div class="action-buttons">
        <button id="attack60Btn" class="action-button attack-btn">
          Deal 60 Damage
        </button>
        
        <button id="attack100Btn" class="action-button attack-btn">
          Deal 100 Damage
        </button>
        
        <button id="koPlayerBtn" class="action-button danger-btn">
          KO Active Pokemon
        </button>
        
        <button id="cheerBtn" class="action-button cheer-btn" disabled>
          Use Cheer Card
        </button>

        <div class="cheer-selection" id="cheerSelection" style="display: none;">
          <select id="cheerCardSelect">
            <option value="1">Card 1: Double Damage</option>
            <option value="2">Card 2: Heal All (+80 HP)</option>
            <option value="3">Card 3: Full Heal One</option>
            <option value="4">Card 4: Limit Boss Attacks</option>
            <option value="5">Card 5: +50 All Damage</option>
          </select>
          <button id="confirmCheerBtn" class="action-button">Confirm</button>
        </div>
      </div>

      <div class="test-controls" style="margin-top: 20px;">
        <h4 style="color: #f39c12;">Test Controls</h4>
        <button id="resetGameBtn" class="action-button warning-btn">
          Reset Game
        </button>
        <button id="joinSpectatorBtn" class="action-button">
          Join as Spectator
        </button>
      </div>
    `;

    return panel;
  }

  createStatusPanel() {
    const panel = document.createElement('div');
    panel.className = 'status-panel';
    panel.style.cssText = `
      background: rgba(155, 89, 182, 0.1);
      border-radius: 15px;
      padding: 20px;
      border: 2px solid rgba(155, 89, 182, 0.3);
      grid-column: 3;
      grid-row: 2;
    `;

    panel.innerHTML = `
      <h3 style="color: #9b59b6; margin-top: 0;">Game Status</h3>
      
      <div class="ko-tracker">
        <div class="ko-count">KO Count: <span id="koCount">0</span>/4</div>
        <div class="ko-bar">
          <div class="ko-fill" id="koFill"></div>
        </div>
      </div>

      <div class="cheer-tracker" style="margin-top: 15px;">
        <div class="cheer-count">Cheer Cards: <span id="cheerCount">0</span>/3</div>
        <div class="available-cheers" id="availableCheers">1, 2, 3, 4, 5</div>
      </div>

      <div class="player-list" style="margin-top: 15px;">
        <h4 style="color: #ecf0f1;">Players</h4>
        <div id="playersList"></div>
      </div>

      <div class="game-log" style="margin-top: 15px;">
        <h4 style="color: #ecf0f1;">Recent Actions</h4>
        <div id="gameLog" style="max-height: 100px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 5px; font-size: 12px;"></div>
      </div>
    `;

    return panel;
  }

  createSpectatorPanel() {
    const panel = document.createElement('div');
    panel.className = 'spectator-panel';
    panel.style.cssText = `
      background: rgba(155, 89, 182, 0.1);
      border-radius: 15px;
      padding: 20px;
      border: 2px dashed rgba(155, 89, 182, 0.5);
      grid-column: 1 / 4;
      grid-row: 3;
      display: none;
    `;

    panel.innerHTML = `
      <h3 style="color: #9b59b6; margin-top: 0;">👁️ Spectator Mode</h3>
      <p style="color: #ecf0f1;">You are watching this raid battle. You can see all actions but cannot participate.</p>
      
      <div class="spectator-chat">
        <div id="spectatorChatLog" style="height: 100px; overflow-y: auto; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 5px; margin-bottom: 10px;"></div>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="spectatorChatInput" placeholder="Chat with other spectators..." style="flex: 1; padding: 8px; border-radius: 5px; border: 1px solid #9b59b6; background: rgba(0,0,0,0.3); color: white;">
          <button id="spectatorChatBtn" class="action-button">Send</button>
        </div>
      </div>
    `;

    return panel;
  }

  // ================ EVENT HANDLERS ================

  handleRaidJoined(data) {
    this.gameState = data.raidState;
    this.show();
    this.setupActionListeners();
    this.updateAllPanels();
  }

  handleActionResult(data) {
    this.logAction(`${data.action.type}: ${JSON.stringify(data.result)}`);
    
    if (data.newState) {
      this.gameState = data.newState;
      this.updateAllPanels();
    }
  }

  handleSpectatorModeChange(data) {
    this.isSpectator = data.isSpectator;
    this.turnIndicator?.setSpectatorMode(this.isSpectator);
    this.updateSpectatorUI();
  }

  handleGameEnd(data) {
    const message = data.victory ? '🎉 Victory! Boss Defeated!' : '💀 Defeat! Too Many KOs!';
    const color = data.victory ? '#2ecc71' : '#e74c3c';
    
    this.showNotification(message, color, 5000);
  }

  // ================ ACTION LISTENERS ================

  setupActionListeners() {
    // Attack buttons
    document.getElementById('attack60Btn')?.addEventListener('click', () => {
      this.sendRaidAction('playerAttack', { pokemon: 'active', attackName: 'Basic Attack', damage: 60 });
    });

    document.getElementById('attack100Btn')?.addEventListener('click', () => {
      this.sendRaidAction('playerAttack', { pokemon: 'active', attackName: 'Power Attack', damage: 100 });
    });

    // KO button for testing
    document.getElementById('koPlayerBtn')?.addEventListener('click', () => {
      this.sendRaidAction('testKO', { pokemon: 'active' });
    });

    // Retreat button
    document.getElementById('retreatBtn')?.addEventListener('click', () => {
      this.sendRaidAction('playerRetreat', {});
    });

    // Cheer card system
    document.getElementById('cheerBtn')?.addEventListener('click', () => {
      document.getElementById('cheerSelection').style.display = 'block';
    });

    document.getElementById('confirmCheerBtn')?.addEventListener('click', () => {
      const cardNumber = parseInt(document.getElementById('cheerCardSelect').value);
      this.sendRaidAction('cheerCard', { cardNumber });
      document.getElementById('cheerSelection').style.display = 'none';
    });

    // Test controls
    document.getElementById('resetGameBtn')?.addEventListener('click', () => {
      this.sendRaidAction('resetGame', {});
    });

    document.getElementById('joinSpectatorBtn')?.addEventListener('click', () => {
      this.sendRaidAction('joinAsSpectator', {});
    });

    // Spectator chat
    document.getElementById('spectatorChatBtn')?.addEventListener('click', () => {
      const input = document.getElementById('spectatorChatInput');
      if (input.value.trim()) {
        this.sendRaidAction('spectatorChat', { message: input.value.trim() });
        input.value = '';
      }
    });
  }

  sendRaidAction(actionType, data) {
    socket.emit('raidAction', {
      raidId: this.gameState?.id,
      action: {
        type: actionType,
        ...data
      }
    });
  }

  // ================ UI UPDATES ================

  updateAllPanels() {
    if (!this.gameState) return;

    this.updatePlayerPanel();
    this.updateBossPanel();
    this.updateStatusPanel();
    this.updatePlayersList();
  }

  updatePlayerPanel() {
    const myPlayer = this.gameState.players?.[this.myPlayerId];
    if (!myPlayer) return;

    // Update active Pokemon
    this.updatePokemonCard('active', myPlayer.pokemon.active);
    this.updatePokemonCard('bench', myPlayer.pokemon.bench);

    // Update retreat button state
    const retreatBtn = document.getElementById('retreatBtn');
    if (retreatBtn) {
      retreatBtn.disabled = this.isSpectator || myPlayer.status !== 'active';
    }

    // Update cheer button
    const cheerBtn = document.getElementById('cheerBtn');
    if (cheerBtn) {
      cheerBtn.disabled = !myPlayer.canUseCheer || this.isSpectator;
    }
  }

  updatePokemonCard(type, pokemon) {
    const nameEl = document.querySelector(`#${type}Card .pokemon-name`);
    const hpFillEl = document.getElementById(`${type}HP`);
    const hpTextEl = document.getElementById(`${type}HPText`);
    const attacksEl = document.getElementById(`${type}Attacks`);

    if (nameEl) nameEl.textContent = pokemon.name;
    if (hpTextEl) hpTextEl.textContent = `${pokemon.hp}/${pokemon.maxHP}`;
    
    if (hpFillEl) {
      const hpPercent = (pokemon.hp / pokemon.maxHP) * 100;
      hpFillEl.style.width = `${hpPercent}%`;
      hpFillEl.style.background = hpPercent > 50 ? '#2ecc71' : hpPercent > 25 ? '#f39c12' : '#e74c3c';
    }

    if (attacksEl) {
      attacksEl.innerHTML = pokemon.attacks.map(attack => 
        `<div class="attack">${attack.name}: ${attack.damage}</div>`
      ).join('');
    }

    // Add KO styling
    const card = document.getElementById(`${type}Card`);
    if (card) {
      if (pokemon.status === 'ko') {
        card.style.opacity = '0.5';
        card.style.border = '2px solid #e74c3c';
      } else {
        card.style.opacity = '1';
        card.style.border = 'none';
      }
    }
  }

  updateBossPanel() {
    const boss = this.gameState.boss;
    if (!boss) return;

    document.getElementById('bossName').textContent = boss.card.name;
    document.getElementById('bossLevel').textContent = `Level ${boss.level}`;
    document.getElementById('bossHPText').textContent = `${boss.currentHP}/${boss.maxHP}`;
    document.getElementById('bossAttacks').textContent = boss.maxAttacksPerTurn;
    document.getElementById('currentAttacks').textContent = boss.attacksThisTurn;

    const hpPercent = (boss.currentHP / boss.maxHP) * 100;
    const hpFill = document.getElementById('bossHP');
    if (hpFill) {
      hpFill.style.width = `${hpPercent}%`;
      hpFill.style.background = hpPercent > 50 ? '#e74c3c' : hpPercent > 25 ? '#f39c12' : '#27ae60';
    }

    document.getElementById('bossStatus').textContent = boss.status === 'defeated' ? 'DEFEATED!' : 'Active';
  }

  updateStatusPanel() {
    // KO tracking
    document.getElementById('koCount').textContent = this.gameState.koTracking?.total || 0;
    const koPercent = ((this.gameState.koTracking?.total || 0) / 4) * 100;
    const koFill = document.getElementById('koFill');
    if (koFill) {
      koFill.style.width = `${koPercent}%`;
      koFill.style.background = koPercent > 75 ? '#e74c3c' : koPercent > 50 ? '#f39c12' : '#2ecc71';
    }

    // Cheer tracking
    document.getElementById('cheerCount').textContent = this.gameState.cheerSystem?.used || 0;
    document.getElementById('availableCheers').textContent = 
      this.gameState.cheerSystem?.available?.join(', ') || 'None';
  }

  updatePlayersList() {
    const playersListEl = document.getElementById('playersList');
    if (!playersListEl) return;

    const players = Object.values(this.gameState.players || {});
    playersListEl.innerHTML = players.map(player => `
      <div class="player-status" style="margin: 5px 0; color: ${this.getPlayerStatusColor(player.status)};">
        ${player.username} (${player.status})
      </div>
    `).join('');
  }

  updateSpectatorUI() {
    const spectatorPanel = document.querySelector('.spectator-panel');
    const actionsPanel = document.querySelector('.actions-panel');
    
    if (this.isSpectator) {
      spectatorPanel.style.display = 'block';
      actionsPanel.style.opacity = '0.5';
      actionsPanel.style.pointerEvents = 'none';
    } else {
      spectatorPanel.style.display = 'none';
      actionsPanel.style.opacity = '1';
      actionsPanel.style.pointerEvents = 'auto';
    }
  }

  // ================ UTILITY METHODS ================

  getPlayerStatusColor(status) {
    switch (status) {
      case 'active': return '#2ecc71';
      case 'spectator': return '#9b59b6';
      case 'eliminated': return '#e74c3c';
      default: return '#ecf0f1';
    }
  }

  logAction(message) {
    const logEl = document.getElementById('gameLog');
    if (logEl) {
      const timestamp = new Date().toLocaleTimeString();
      logEl.innerHTML += `<div>[${timestamp}] ${message}</div>`;
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  showNotification(message, color = '#3498db', duration = 3000) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${color};
      color: white;
      padding: 20px 40px;
      border-radius: 10px;
      font-size: 24px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      animation: notificationPop 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'notificationFade 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }

  show() {
    this.gameContainer.style.display = 'flex';
  }

  hide() {
    this.gameContainer.style.display = 'none';
  }

  destroy() {
    this.turnIndicator?.destroy();
    if (this.gameContainer) {
      this.gameContainer.remove();
    }
  }
}

// Add required CSS
const gameUIStyle = document.createElement('style');
gameUIStyle.textContent = `
  @keyframes notificationPop {
    from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
    to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }
  
  @keyframes notificationFade {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  .action-button {
    width: 100%;
    padding: 10px;
    margin: 5px 0;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
  }

  .attack-btn {
    background: linear-gradient(45deg, #2ecc71, #27ae60);
    color: white;
  }

  .danger-btn {
    background: linear-gradient(45deg, #e74c3c, #c0392b);
    color: white;
  }

  .cheer-btn {
    background: linear-gradient(45deg, #f39c12, #e67e22);
    color: white;
  }

  .warning-btn {
    background: linear-gradient(45deg, #f39c12, #d35400);
    color: white;
  }

  .retreat-btn {
    background: linear-gradient(45deg, #9b59b6, #8e44ad);
    color: white;
  }

  .action-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  }

  .action-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hp-bar-container {
    margin: 10px 0;
  }

  .hp-bar, .boss-hp-bar, .ko-bar {
    width: 100%;
    height: 12px;
    background: rgba(0,0,0,0.3);
    border-radius: 6px;
    overflow: hidden;
  }

  .hp-fill, .boss-hp-fill, .ko-fill {
    height: 100%;
    transition: width 0.5s ease, background 0.3s ease;
  }

  .pokemon-card {
    background: rgba(0,0,0,0.2);
    padding: 15px;
    border-radius: 10px;
    margin: 10px 0;
  }

  .boss-card {
    background: rgba(0,0,0,0.2);
    padding: 20px;
    border-radius: 15px;
  }

  .attack {
    background: rgba(0,0,0,0.2);
    padding: 5px 10px;
    border-radius: 5px;
    margin: 2px 0;
    font-size: 12px;
  }
`;

if (!document.head.querySelector('[data-game-ui-styles]')) {
  gameUIStyle.setAttribute('data-game-ui-styles', 'true');
  document.head.appendChild(gameUIStyle);
}