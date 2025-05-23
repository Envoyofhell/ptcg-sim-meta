// client/src/raid/RaidClient.js
// Basic client integration for raid battles

import { socket, systemState } from '../front-end.js';

export class RaidClient {
  constructor() {
    this.currentRaid = null;
    this.playerPosition = null;
    this.allPositions = [];
    this.bossPosition = null;
    this.isInRaid = false;
    
    this.setupSocketListeners();
    this.setupUI();
  }

  setupSocketListeners() {
    // Raid-specific socket events
    socket.on('raidCreated', (data) => this.handleRaidCreated(data));
    socket.on('raidJoined', (data) => this.handleRaidJoined(data));
    socket.on('playerJoinedRaid', (data) => this.handlePlayerJoined(data));
    socket.on('playerLeftRaid', (data) => this.handlePlayerLeft(data));
    socket.on('layoutUpdated', (data) => this.handleLayoutUpdate(data));
    socket.on('raidActionResult', (data) => this.handleActionResult(data));
    
    // Error handling
    socket.on('raidJoinFailed', (data) => this.handleRaidError(data));
    socket.on('raidActionFailed', (data) => this.handleActionError(data));
  }

  setupUI() {
    // Create raid UI elements (basic implementation)
    this.createRaidContainer();
    this.createRaidControls();
  }

  createRaidContainer() {
    // Create main raid table container
    const raidContainer = document.createElement('div');
    raidContainer.id = 'raidContainer';
    raidContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(45deg, #2c3e50 0%, #3498db 100%);
      display: none;
      z-index: 1000;
    `;

    // Create the angled table surface
    const tableContainer = document.createElement('div');
    tableContainer.id = 'raidTable';
    tableContainer.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 80vw;
      height: 80vh;
      background: 
        radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 50%),
        linear-gradient(45deg, #34495e 0%, #2c3e50 100%);
      border-radius: 20px;
      transform: translate(-50%, -50%) perspective(1000px) rotateX(15deg);
      box-shadow: 
        0 20px 60px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.1);
      overflow: hidden;
    `;

    // Create player zones container
    const playersContainer = document.createElement('div');
    playersContainer.id = 'raidPlayers';
    playersContainer.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;

    // Create boss zone
    const bossContainer = document.createElement('div');
    bossContainer.id = 'raidBoss';
    bossContainer.style.cssText = `
      position: absolute;
      width: 200px;
      height: 300px;
      background: radial-gradient(circle, #e74c3c 0%, #c0392b 100%);
      border: 3px solid #fff;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
      transform: translate(-50%, -50%);
    `;
    bossContainer.innerHTML = 'RAID BOSS';

    tableContainer.appendChild(playersContainer);
    tableContainer.appendChild(bossContainer);
    raidContainer.appendChild(tableContainer);
    document.body.appendChild(raidContainer);

    this.raidContainer = raidContainer;
    this.tableContainer = tableContainer;
    this.playersContainer = playersContainer;
    this.bossContainer = bossContainer;
  }

  createRaidControls() {
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'raidControls';
    controlsContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.8);
      padding: 20px;
      border-radius: 10px;
      color: white;
      z-index: 1001;
      display: none;
    `;

    controlsContainer.innerHTML = `
      <h3>Raid Controls</h3>
      <button id="raidLayoutToggle">Switch Layout</button>
      <button id="raidLeave">Leave Raid</button>
      <div id="raidInfo">
        <p>Players: <span id="raidPlayerCount">0</span>/4</p>
        <p>Layout: <span id="raidCurrentLayout">versus</span></p>
      </div>
    `;

    document.body.appendChild(controlsContainer);
    this.controlsContainer = controlsContainer;

    // Setup control handlers
    document.getElementById('raidLayoutToggle').addEventListener('click', () => {
      this.toggleLayout();
    });

    document.getElementById('raidLeave').addEventListener('click', () => {
      this.leaveRaid();
    });
  }

  // Public methods for creating/joining raids
  createRaid(config = {}) {
    const raidConfig = {
      raidType: 'tcg-official',
      maxPlayers: 4,
      minPlayers: 2,
      layout: 'versus',
      ...config
    };

    socket.emit('createRaid', {
      roomId: this.generateRaidId(),
      ...raidConfig
    });
  }

  joinRaid(raidId, username = systemState.p2SelfUsername || 'Player') {
    socket.emit('joinRaid', {
      raidId: raidId,
      username: username,
      deckData: systemState.selfDeckData
    });
  }

  leaveRaid() {
    if (this.currentRaid) {
      socket.emit('leaveRaid', { raidId: this.currentRaid.id });
      this.exitRaidView();
    }
  }

  toggleLayout() {
    if (!this.currentRaid) return;

    const newLayout = this.currentRaid.layout === 'versus' ? 'circular' : 'versus';
    socket.emit('updateRaidLayout', {
      raidId: this.currentRaid.id,
      layout: newLayout
    });
  }

  // Socket event handlers
  handleRaidCreated(data) {
    if (data.success) {
      console.log('Raid created:', data.raidId);
      this.currentRaid = {
        id: data.raidId,
        config: data.config,
        state: data.state,
        layout: data.config.layout
      };
    } else {
      console.error('Failed to create raid:', data.error);
    }
  }

  handleRaidJoined(data) {
    if (data.success) {
      console.log('Joined raid:', data.raidId);
      this.currentRaid = { id: data.raidId, ...data.raidState };
      this.playerPosition = data.yourPosition;
      this.allPositions = data.allPositions;
      this.isInRaid = true;

      this.enterRaidView();
      this.updatePlayerPositions();
    } else {
      console.error('Failed to join raid:', data.error);
    }
  }

  handlePlayerJoined(data) {
    console.log('Player joined raid:', data.username);
    this.allPositions = data.positions;
    this.updatePlayerPositions();
    this.updateRaidInfo(data.playerCount);
  }

  handlePlayerLeft(data) {
    console.log('Player left raid:', data.leftPlayerId);
    this.allPositions = data.newPositions;
    this.updatePlayerPositions();
    this.updateRaidInfo(data.playerCount);
  }

  handleLayoutUpdate(data) {
    console.log('Layout updated:', data.layout);
    this.currentRaid.layout = data.layout;
    this.allPositions = data.positions;
    this.bossPosition = data.bossPosition;
    
    this.updatePlayerPositions();
    this.updateBossPosition();
    this.updateLayoutInfo(data.layout);
  }

  handleActionResult(data) {
    console.log('Raid action result:', data);
    // Handle raid-specific actions here
  }

  handleRaidError(data) {
    console.error('Raid error:', data.error);
    alert('Raid Error: ' + data.error);
  }

  handleActionError(data) {
    console.error('Action error:', data.error);
  }

  // UI update methods
  enterRaidView() {
    // Hide normal TCG interface
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('connectedRoom').style.display = 'none';
    
    // Show raid interface
    this.raidContainer.style.display = 'block';
    this.controlsContainer.style.display = 'block';
    
    console.log('Entered raid view');
  }

  exitRaidView() {
    // Show normal TCG interface
    document.getElementById('lobby').style.display = 'block';
    
    // Hide raid interface
    this.raidContainer.style.display = 'none';
    this.controlsContainer.style.display = 'none';
    
    // Reset state
    this.currentRaid = null;
    this.playerPosition = null;
    this.allPositions = [];
    this.isInRaid = false;
    
    console.log('Exited raid view');
  }

  updatePlayerPositions() {
    // Clear existing player elements
    this.playersContainer.innerHTML = '';

    this.allPositions.forEach((position, index) => {
      const playerElement = document.createElement('div');
      playerElement.className = 'raid-player';
      playerElement.style.cssText = `
        position: absolute;
        width: 120px;
        height: 80px;
        background: ${position.playerId === socket.id ? 
          'linear-gradient(45deg, #27ae60 0%, #2ecc71 100%)' : 
          'linear-gradient(45deg, #3498db 0%, #2980b9 100%)'};
        border: 2px solid #fff;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
        left: ${position.x}%;
        top: ${position.y}%;
        transform: translate(-50%, -50%) rotate(${position.angle}deg);
        z-index: ${100 - Math.floor(position.overlapFactor * 10)};
      `;

      playerElement.innerHTML = `
        <div style="text-align: center;">
          <div>Player ${index + 1}</div>
          <div style="font-size: 10px; opacity: 0.8;">${Math.round(position.angle)}°</div>
        </div>
      `;

      // Add special styling for current player
      if (position.playerId === socket.id) {
        playerElement.style.border = '3px solid #f1c40f';
        playerElement.innerHTML = `
          <div style="text-align: center;">
            <div>YOU</div>
            <div style="font-size: 10px; opacity: 0.8;">${Math.round(position.angle)}°</div>
          </div>
        `;
      }

      this.playersContainer.appendChild(playerElement);
    });
  }

  updateBossPosition() {
    if (!this.bossPosition) return;

    this.bossContainer.style.left = `${this.bossPosition.x}%`;
    this.bossContainer.style.top = `${this.bossPosition.y}%`;
  }

  updateRaidInfo(playerCount) {
    const countElement = document.getElementById('raidPlayerCount');
    if (countElement) {
      countElement.textContent = playerCount;
    }
  }

  updateLayoutInfo(layout) {
    const layoutElement = document.getElementById('raidCurrentLayout');
    if (layoutElement) {
      layoutElement.textContent = layout;
    }
  }

  generateRaidId() {
    return Math.random().toString(36).substring(2, 15);
  }

  // Public method to send raid actions
  sendAction(action) {
    if (!this.currentRaid) return;

    socket.emit('raidAction', {
      raidId: this.currentRaid.id,
      action: action
    });
  }
}

// client/src/raid/RaidUI.js
// Enhanced UI components for raids

export class RaidUI {
  static createPlayerCard(position, isCurrentPlayer = false) {
    const card = document.createElement('div');
    card.className = `raid-player-card ${isCurrentPlayer ? 'current-player' : ''}`;
    
    card.style.cssText = `
      position: absolute;
      width: 100px;
      height: 140px;
      background: ${isCurrentPlayer ? 
        'linear-gradient(135deg, #f1c40f 0%, #f39c12 100%)' : 
        'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'};
      border: 2px solid #fff;
      border-radius: 8px;
      box-shadow: 
        0 4px 8px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.2);
      transform-style: preserve-3d;
      transition: all 0.3s ease;
      cursor: pointer;
    `;

    // Add hover effects
    card.addEventListener('mouseenter', () => {
      card.style.transform += ' scale(1.05) translateZ(10px)';
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = card.style.transform.replace(' scale(1.05) translateZ(10px)', '');
    });

    return card;
  }

  static createBossCard(bossData = {}) {
    const boss = document.createElement('div');
    boss.className = 'raid-boss-card';
    
    boss.style.cssText = `
      position: absolute;
      width: 200px;
      height: 280px;
      background: 
        linear-gradient(135deg, #e74c3c 0%, #c0392b 100%),
        url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
      border: 3px solid #fff;
      border-radius: 12px;
      box-shadow: 
        0 8px 24px rgba(0,0,0,0.4),
        inset 0 2px 0 rgba(255,255,255,0.1);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
      transform-style: preserve-3d;
      animation: bossIdle 4s ease-in-out infinite;
    `;

    boss.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 18px; margin-bottom: 10px;">RAID BOSS</div>
        <div style="font-size: 14px; opacity: 0.9;">${bossData.name || 'Mysterious Pokémon'}</div>
        <div style="margin-top: 10px; font-size: 12px;">
          HP: ${bossData.hp || '???'} / ${bossData.maxHP || '???'}
        </div>
      </div>
    `;

    return boss;
  }

  static addCSSAnimations() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes bossIdle {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-5px) scale(1.02); }
      }

      .raid-player-card:hover {
        box-shadow: 
          0 8px 16px rgba(0,0,0,0.4),
          inset 0 1px 0 rgba(255,255,255,0.3);
      }

      .current-player {
        box-shadow: 
          0 4px 8px rgba(0,0,0,0.3),
          0 0 20px rgba(241,196,15,0.6),
          inset 0 1px 0 rgba(255,255,255,0.2);
      }
    `;
    document.head.appendChild(style);
  }
}

// Auto-initialize CSS animations
RaidUI.addCSSAnimations();