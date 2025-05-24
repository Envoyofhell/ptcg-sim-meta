  // server/raid/core/RaidInstance.js
  // Individual raid instance that manages state and players
  
  export class RaidInstance {
    constructor(id, raidType, config, geometryManager) {
      this.id = id;
      this.type = raidType;
      this.config = config;
      this.geometryManager = geometryManager;
      
      this.state = 'lobby'; // lobby, active, victory, defeat
      this.players = new Map();
      this.playerPositions = [];
      this.boss = null;
      this.turnState = 'waiting';
      
      // Initialize raid-specific state
      this.gameState = this.type.initializeGameState(config);
    }
  
    addPlayer(playerId, playerData) {
      if (this.players.size >= this.config.maxPlayers) {
        return false;
      }
  
      if (this.state !== 'lobby') {
        return false; // Can't join active raids
      }
  
      this.players.set(playerId, {
        id: playerId,
        ...playerData,
        joinedAt: Date.now(),
        isReady: false
      });
  
      return true;
    }
  
    removePlayer(playerId) {
      const removed = this.players.delete(playerId);
      if (removed && this.players.size > 0) {
        // Recalculate positions when someone leaves
        this.geometryManager.recalculatePositions(this);
      }
      return removed;
    }
  
    startRaid() {
      if (this.players.size < this.config.minPlayers) {
        return { success: false, error: 'Not enough players' };
      }
  
      // Initialize boss based on raid type
      this.boss = this.type.createBoss(this.config, this.players);
      
      // Calculate initial positions
      this.geometryManager.calculatePlayerPositions(this);
      
      this.state = 'active';
      this.turnState = 'players';
      
      return { 
        success: true, 
        gameState: this.getState(),
        positions: this.playerPositions
      };
    }
  
    processPlayerAction(playerId, action) {
      if (this.state !== 'active') {
        return { success: false, error: 'Raid not active' };
      }
  
      const player = this.players.get(playerId);
      if (!player) {
        return { success: false, error: 'Player not found' };
      }
  
      // Process action through raid type handler
      const result = this.type.processAction(this.gameState, player, action);
      
      if (result.success) {
        // Check for state changes
        this.checkWinConditions();
        
        // Update positions if needed
        if (result.recalculatePositions) {
          this.geometryManager.recalculatePositions(this);
        }
      }
  
      return result;
    }
  
    processBossTurn() {
      if (this.turnState !== 'boss') return;
  
      const bossAction = this.type.generateBossAction(this.gameState, this.players);
      const result = this.type.processBossAction(this.gameState, bossAction);
  
      this.turnState = 'players';
      
      return result;
    }
  
    checkWinConditions() {
      const winCheck = this.type.checkWinCondition(this.gameState);
      const lossCheck = this.type.checkLossCondition(this.gameState);
  
      if (winCheck.hasWon) {
        this.state = 'victory';
        return { victory: true, reason: winCheck.reason };
      }
  
      if (lossCheck.hasLost) {
        this.state = 'defeat';
        return { defeat: true, reason: lossCheck.reason };
      }
  
      return { continuing: true };
    }
  
    getState() {
      return {
        id: this.id,
        state: this.state,
        turnState: this.turnState,
        players: Array.from(this.players.values()),
        playerPositions: this.playerPositions,
        bossPosition: this.geometryManager.getBossPosition(this),
        boss: this.boss,
        gameState: this.gameState,
        config: this.config
      };
    }
  }