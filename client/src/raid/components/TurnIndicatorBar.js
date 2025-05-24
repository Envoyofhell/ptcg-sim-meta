// ===================================================================
// File: client/src/raid/components/TurnIndicatorBar.js
// Path: /client/src/raid/components/TurnIndicatorBar.js
// Location: Client-side turn indicator visualization
// Changes: Initial implementation of dynamic turn bar UI
// Dependencies: ../RaidClient.js, ../../front-end.js
// Dependents: RaidGameUI.js, index.html
// Changelog:
//   v1.0.0 - Initial turn indicator with player colors
//   v1.0.1 - Added stage progression and animations
//   v1.0.2 - Added spectator-friendly display modes
// Version: 1.0.2
// ===================================================================

import { socket } from '../../initialization/global-variables/global-variables.js';

export class TurnIndicatorBar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentTurnInfo = null;
    this.animationSpeed = 300; // ms
    this.isSpectator = false;

    // UI settings
    this.settings = {
      layout: 'horizontal', // horizontal, vertical, circular
      showStageDetails: true,
      showPlayerColors: true,
      compactMode: false,
      animateTransitions: true,
    };

    this.setupEventListeners();
    this.createIndicatorStructure();
  }

  // ================ INITIALIZATION ================

  createIndicatorStructure() {
    if (!this.container) {
      console.error('Turn indicator container not found');
      return;
    }

    this.container.innerHTML = '';
    this.container.className = 'turn-indicator-bar';

    // Main indicator container
    const indicatorTrack = document.createElement('div');
    indicatorTrack.className = 'indicator-track';
    indicatorTrack.style.cssText = `
      display: flex;
      align-items: center;
      background: linear-gradient(90deg, #34495e 0%, #2c3e50 100%);
      border-radius: 25px;
      padding: 10px 20px;
      box-shadow: 
        0 4px 15px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.1);
      min-height: 50px;
      position: relative;
      overflow: hidden;
    `;

    // Phase indicator
    const phaseIndicator = document.createElement('div');
    phaseIndicator.className = 'phase-indicator';
    phaseIndicator.style.cssText = `
      font-weight: bold;
      color: #ecf0f1;
      margin-right: 20px;
      font-size: 14px;
      min-width: 80px;
    `;

    // Player indicators container
    const playersContainer = document.createElement('div');
    playersContainer.className = 'players-container';
    playersContainer.style.cssText = `
      display: flex;
      align-items: center;
      flex: 1;
      gap: 15px;
    `;

    // Stage details container
    const stageContainer = document.createElement('div');
    stageContainer.className = 'stage-container';
    stageContainer.style.cssText = `
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    indicatorTrack.appendChild(phaseIndicator);
    indicatorTrack.appendChild(playersContainer);
    indicatorTrack.appendChild(stageContainer);
    this.container.appendChild(indicatorTrack);

    // Store references
    this.phaseIndicator = phaseIndicator;
    this.playersContainer = playersContainer;
    this.stageContainer = stageContainer;
    this.indicatorTrack = indicatorTrack;
  }

  setupEventListeners() {
    // Listen for turn updates from server
    socket.on('turnEvent', (data) => this.handleTurnUpdate(data));
    socket.on('raidActionResult', (data) => this.handleActionResult(data));
    socket.on('playerJoinedRaid', (data) => this.handlePlayerChange(data));
    socket.on('playerLeftRaid', (data) => this.handlePlayerChange(data));
  }

  // ================ EVENT HANDLERS ================

  handleTurnUpdate(data) {
    if (data.turnIndicator) {
      this.currentTurnInfo = data.turnIndicator;
      this.updateIndicatorDisplay();
    }
  }

  handleActionResult(data) {
    // Update indicator based on action results
    if (data.result && data.result.nextTurn) {
      this.currentTurnInfo = data.result.nextTurn.indicator;
      this.updateIndicatorDisplay();
    }
  }

  handlePlayerChange(data) {
    // Refresh indicator when players join/leave
    this.requestTurnUpdate();
  }

  requestTurnUpdate() {
    // Request current turn info from server
    socket.emit('requestTurnInfo');
  }

  // ================ DISPLAY UPDATES ================

  updateIndicatorDisplay() {
    if (!this.currentTurnInfo || !this.currentTurnInfo.elements) return;

    this.updatePhaseIndicator();
    this.updatePlayerIndicators();
    this.updateStageIndicators();
  }

  updatePhaseIndicator() {
    if (!this.phaseIndicator || !this.currentTurnInfo) return;

    const phase = this.currentTurnInfo.elements.find((e) => e.type === 'boss')
      ? 'Boss Turn'
      : 'Player Turns';
    this.phaseIndicator.textContent = phase;

    // Color based on phase
    this.phaseIndicator.style.color =
      phase === 'Boss Turn' ? '#e74c3c' : '#3498db';
  }

  updatePlayerIndicators() {
    if (!this.playersContainer) return;

    this.playersContainer.innerHTML = '';

    const playerElements = this.currentTurnInfo.elements.filter(
      (e) => e.type === 'player'
    );
    const bossElements = this.currentTurnInfo.elements.filter(
      (e) => e.type === 'boss'
    );

    if (bossElements.length > 0) {
      this.createBossIndicator(bossElements[0]);
    } else {
      playerElements.forEach((player) => this.createPlayerIndicator(player));
    }
  }

  createPlayerIndicator(playerData) {
    const playerElement = document.createElement('div');
    playerElement.className = `player-indicator ${playerData.status}`;

    const isCurrentPlayer = playerData.status === 'current';
    const scale = isCurrentPlayer
      ? 1.2
      : playerData.status === 'next'
        ? 1.0
        : 0.8;

    playerElement.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 12px;
      border-radius: 12px;
      background: ${playerData.color || '#3498db'};
      color: white;
      font-size: 12px;
      font-weight: bold;
      transform: scale(${scale});
      opacity: ${playerData.opacity || 1};
      border: ${isCurrentPlayer ? '3px solid #f1c40f' : '2px solid rgba(255,255,255,0.3)'};
      box-shadow: ${isCurrentPlayer ? '0 0 15px rgba(241,196,15,0.6)' : '0 2px 8px rgba(0,0,0,0.3)'};
      transition: all ${this.animationSpeed}ms ease;
      min-width: 80px;
      cursor: ${isCurrentPlayer ? 'default' : 'pointer'};
    `;

    // Player name
    const nameDiv = document.createElement('div');
    nameDiv.textContent = playerData.username;
    nameDiv.style.marginBottom = '4px';
    playerElement.appendChild(nameDiv);

    // Turn count
    if (playerData.turnsCompleted > 0) {
      const turnCount = document.createElement('div');
      turnCount.textContent = `Turn ${playerData.turnsCompleted + 1}`;
      turnCount.style.cssText = `
        font-size: 10px;
        opacity: 0.8;
      `;
      playerElement.appendChild(turnCount);
    }

    // Current stage for active player
    if (isCurrentPlayer && playerData.stage && this.settings.showStageDetails) {
      const stageDiv = document.createElement('div');
      stageDiv.textContent = `Stage ${playerData.stage}`;
      stageDiv.style.cssText = `
        font-size: 10px;
        background: rgba(255,255,255,0.2);
        padding: 2px 6px;
        border-radius: 8px;
        margin-top: 4px;
      `;
      playerElement.appendChild(stageDiv);
    }

    // Add hover effects for non-current players
    if (!isCurrentPlayer) {
      playerElement.addEventListener('mouseenter', () => {
        playerElement.style.transform = `scale(${Math.min(scale * 1.1, 1.1)})`;
        playerElement.style.opacity = Math.min(1, playerData.opacity + 0.2);
      });

      playerElement.addEventListener('mouseleave', () => {
        playerElement.style.transform = `scale(${scale})`;
        playerElement.style.opacity = playerData.opacity || 1;
      });
    }

    this.playersContainer.appendChild(playerElement);
  }

  createBossIndicator(bossData) {
    const bossElement = document.createElement('div');
    bossElement.className = 'boss-indicator current';

    bossElement.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 20px;
      border-radius: 15px;
      background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
      color: white;
      font-size: 14px;
      font-weight: bold;
      border: 3px solid #fff;
      box-shadow: 
        0 0 20px rgba(231,76,60,0.6),
        0 4px 15px rgba(0,0,0,0.3);
      animation: bossGlow 2s ease-in-out infinite;
      min-width: 120px;
    `;

    // Boss name
    const nameDiv = document.createElement('div');
    nameDiv.textContent = bossData.name || 'Raid Boss';
    nameDiv.style.marginBottom = '6px';
    bossElement.appendChild(nameDiv);

    // Boss status
    const statusDiv = document.createElement('div');
    statusDiv.textContent = bossData.stageDescription || 'Acting';
    statusDiv.style.cssText = `
      font-size: 11px;
      opacity: 0.9;
      margin-bottom: 4px;
    `;
    bossElement.appendChild(statusDiv);

    // Attack counter
    if (bossData.attacksRemaining !== undefined) {
      const attacksDiv = document.createElement('div');
      attacksDiv.textContent = `${bossData.attacksRemaining}/${bossData.maxAttacks} attacks`;
      attacksDiv.style.cssText = `
        font-size: 10px;
        background: rgba(255,255,255,0.2);
        padding: 2px 8px;
        border-radius: 10px;
      `;
      bossElement.appendChild(attacksDiv);
    }

    this.playersContainer.appendChild(bossElement);
  }

  updateStageIndicators() {
    if (!this.stageContainer || !this.settings.showStageDetails) return;

    this.stageContainer.innerHTML = '';

    const currentPlayer = this.currentTurnInfo.elements.find(
      (e) => e.type === 'player' && e.status === 'current'
    );
    if (!currentPlayer) return;

    // Create stage progression dots
    for (let stage = 1; stage <= 3; stage++) {
      const stageDot = document.createElement('div');
      stageDot.className = 'stage-dot';

      const isComplete = stage < currentPlayer.stage;
      const isCurrent = stage === currentPlayer.stage;
      const isUpcoming = stage > currentPlayer.stage;

      stageDot.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${isComplete ? '#2ecc71' : isCurrent ? '#f1c40f' : '#7f8c8d'};
        border: 2px solid ${isCurrent ? '#fff' : 'transparent'};
        box-shadow: ${isCurrent ? '0 0 8px rgba(241,196,15,0.8)' : 'none'};
        transition: all ${this.animationSpeed}ms ease;
        position: relative;
      `;

      // Add stage label on hover
      stageDot.title = this.getStageDescription(stage);

      // Connecting line (except for last dot)
      if (stage < 3) {
        const connector = document.createElement('div');
        connector.style.cssText = `
          width: 20px;
          height: 2px;
          background: ${stage < currentPlayer.stage ? '#2ecc71' : '#7f8c8d'};
          margin: 0 4px;
          transition: background ${this.animationSpeed}ms ease;
        `;
        this.stageContainer.appendChild(stageDot);
        this.stageContainer.appendChild(connector);
      } else {
        this.stageContainer.appendChild(stageDot);
      }
    }
  }

  getStageDescription(stage) {
    switch (stage) {
      case 1:
        return 'Choose Action';
      case 2:
        return 'Resolve Action';
      case 3:
        return 'End Turn';
      default:
        return 'Unknown Stage';
    }
  }

  // ================ CONFIGURATION ================

  setSpectatorMode(isSpectator) {
    this.isSpectator = isSpectator;

    if (isSpectator) {
      this.container.classList.add('spectator-mode');
      // Add spectator-specific styling
      this.indicatorTrack.style.border = '2px dashed rgba(155, 89, 182, 0.6)';
    } else {
      this.container.classList.remove('spectator-mode');
      this.indicatorTrack.style.border = 'none';
    }
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.updateIndicatorDisplay();
  }

  // ================ ANIMATIONS ================

  animateTransition(fromPhase, toPhase) {
    if (!this.settings.animateTransitions) return;

    // Create transition effect
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent 0%, rgba(52,152,219,0.3) 50%, transparent 100%);
      z-index: 10;
      pointer-events: none;
    `;

    this.indicatorTrack.appendChild(overlay);

    // Animate the overlay sweep
    overlay.style.transition = `left ${this.animationSpeed * 2}ms ease`;
    overlay.style.left = '100%';

    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, this.animationSpeed * 2);
  }

  // ================ UTILITY METHODS ================

  hide() {
    this.container.style.display = 'none';
  }

  show() {
    this.container.style.display = 'block';
  }

  destroy() {
    // Clean up event listeners
    socket.off('turnEvent');
    socket.off('raidActionResult');
    socket.off('playerJoinedRaid');
    socket.off('playerLeftRaid');

    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// ================ CSS ANIMATIONS ================

// Add required CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes bossGlow {
    0%, 100% { 
      box-shadow: 
        0 0 20px rgba(231,76,60,0.6),
        0 4px 15px rgba(0,0,0,0.3);
    }
    50% { 
      box-shadow: 
        0 0 30px rgba(231,76,60,0.9),
        0 6px 20px rgba(0,0,0,0.4);
    }
  }

  .turn-indicator-bar {
    width: 100%;
    margin: 10px 0;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  .spectator-mode .indicator-track {
    background: linear-gradient(90deg, #9b59b6 0%, #8e44ad 100%) !important;
  }

  .player-indicator:hover {
    transform: scale(1.05) !important;
  }

  .stage-dot:hover {
    transform: scale(1.3);
  }
`;

if (!document.head.querySelector('[data-turn-indicator-styles]')) {
  style.setAttribute('data-turn-indicator-styles', 'true');
  document.head.appendChild(style);
}
