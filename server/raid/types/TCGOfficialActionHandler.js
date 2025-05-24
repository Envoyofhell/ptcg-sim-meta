// ===================================================================
// File: server/raid/types/TCGOfficialActionHandler.js
// Path: /server/raid/types/TCGOfficialActionHandler.js
// Location: Server-side action processing for TCG Official raids
// Changes: Enhanced integration with RaidGameUI client actions
// Dependencies: TCGOfficialGameState.js, ../core/RaidSocketHandler.js
// Dependents: RaidManager.js, client RaidGameUI.js
// Changelog: 
//   v1.0.0 - Initial action handler for client-server integration
//   v1.0.1 - Added comprehensive error handling and validation
//   v1.0.2 - Enhanced boss turn automation and spectator events
// Version: 1.0.2
// ===================================================================

export class TCGOfficialActionHandler {
    constructor(gameState) {
      this.gameState = gameState;
      this.actionQueue = [];
      this.processingActions = false;
      
      // Action validation rules
      this.validActions = {
        playerAttack: ['pokemon', 'attackName', 'damage'],
        playerRetreat: [],
        cheerCard: ['cardNumber'],
        testKO: ['pokemon'],
        resetGame: [],
        joinAsSpectator: [],
        spectatorChat: ['message']
      };
    }
  
    // ================ MAIN ACTION PROCESSOR ================
  
    async processAction(playerId, action) {
      try {
        // Validate action structure
        const validation = this.validateAction(action);
        if (!validation.valid) {
          return { success: false, error: validation.error };
        }
  
        // Check player permissions
        const permission = this.checkPlayerPermissions(playerId, action);
        if (!permission.allowed) {
          return { success: false, error: permission.error };
        }
  
        // Process the specific action
        let result;
        switch (action.type) {
          case 'playerAttack':
            result = await this.handlePlayerAttack(playerId, action);
            break;
          case 'playerRetreat':
            result = await this.handlePlayerRetreat(playerId, action);
            break;
          case 'cheerCard':
            result = await this.handleCheerCard(playerId, action);
            break;
          case 'testKO':
            result = await this.handleTestKO(playerId, action);
            break;
          case 'resetGame':
            result = await this.handleResetGame(playerId, action);
            break;
          case 'joinAsSpectator':
            result = await this.handleJoinAsSpectator(playerId, action);
            break;
          case 'spectatorChat':
            result = await this.handleSpectatorChat(playerId, action);
            break;
          default:
            result = { success: false, error: `Unknown action type: ${action.type}` };
        }
  
        // Post-process result
        if (result.success) {
          await this.postProcessAction(playerId, action, result);
        }
  
        return result;
  
      } catch (error) {
        console.error('Action processing error:', error);
        return { 
          success: false, 
          error: 'Internal server error processing action',
          details: error.message 
        };
      }
    }
  
    // ================ ACTION HANDLERS ================
  
    async handlePlayerAttack(playerId, action) {
      const { pokemon, attackName, damage } = action;
      
      // Validate it's player's turn
      if (this.gameState.turnManager.getCurrentPlayer() !== playerId) {
        return { success: false, error: 'Not your turn' };
      }
  
      // Process attack through game state
      const attackResult = this.gameState.processPlayerAttack(playerId, {
        pokemon: pokemon,
        attackName: attackName || 'Basic Attack',
        damage: damage || 60
      });
  
      if (!attackResult.success) {
        return attackResult;
      }
  
      // Check for boss defeat
      if (attackResult.bossDefeated) {
        this.gameState.gamePhase = 'victory';
        this.queueBroadcast('gameEnded', {
          victory: true,
          reason: 'Boss defeated!',
          finalBossHP: this.gameState.boss.currentHP,
          winner: this.gameState.players.get(playerId).username
        });
      }
  
      // Check if boss turn should happen next
      if (attackResult.nextTurn?.phase === 'bossTurn') {
        // Queue boss turn after a short delay
        setTimeout(() => this.processBossTurn(), 2000);
      }
  
      return {
        success: true,
        damage: attackResult.damage,
        newBossHP: this.gameState.boss.currentHP,
        bossDefeated: attackResult.bossDefeated,
        nextTurn: attackResult.nextTurn,
        message: `${this.gameState.players.get(playerId).username} dealt ${attackResult.damage} damage to the boss`
      };
    }
  
    async handlePlayerRetreat(playerId, action) {
      const retreatResult = this.gameState.processPlayerRetreat(playerId);
      
      if (!retreatResult.success) {
        return retreatResult;
      }
  
      return {
        success: true,
        newActive: retreatResult.newActive,
        newBench: retreatResult.newBench,
        message: `${this.gameState.players.get(playerId).username} retreated`
      };
    }
  
    async handleCheerCard(playerId, action) {
      const { cardNumber } = action;
      
      const cheerResult = this.gameState.processCheerCard(playerId, cardNumber);
      
      if (!cheerResult.success) {
        return cheerResult;
      }
  
      return {
        success: true,
        cheerCard: cheerResult.cheerCard,
        effect: cheerResult.effect,
        cheerCardsRemaining: cheerResult.cheerCardsRemaining,
        message: `${this.gameState.players.get(playerId).username} used Cheer Card ${cardNumber}`
      };
    }
  
    async handleTestKO(playerId, action) {
      const { pokemon } = action;
      const player = this.gameState.players.get(playerId);
      
      if (!player) {
        return { success: false, error: 'Player not found' };
      }
  
      // KO the specified pokemon
      const targetPokemon = pokemon === 'active' ? player.pokemon.active : player.pokemon.bench;
      targetPokemon.hp = 0;
      targetPokemon.status = 'ko';
      
      player.koCount++;
      this.gameState.totalKOCount++;
      player.canUseCheer = true;
  
      // Check loss condition
      if (this.gameState.totalKOCount >= this.gameState.maxKOCount) {
        this.gameState.gamePhase = 'defeat';
        this.queueBroadcast('gameEnded', {
          victory: false,
          reason: 'Too many Pokemon KO\'d',
          totalKOs: this.gameState.totalKOCount
        });
      }
  
      return {
        success: true,
        koCount: this.gameState.totalKOCount,
        playerCanCheer: player.canUseCheer,
        gamePhase: this.gameState.gamePhase,
        message: `${player.username}'s ${pokemon} Pokemon was KO'd (Test)`
      };
    }
  
    async handleResetGame(playerId, action) {
      // Reset game state
      this.gameState.boss.currentHP = this.gameState.boss.maxHP;
      this.gameState.boss.status = 'active';
      this.gameState.gamePhase = 'playing';
      this.gameState.totalKOCount = 0;
      this.gameState.cheerCardsUsed = 0;
      this.gameState.availableCheerCards = [1, 2, 3, 4, 5];
  
      // Reset all players
      this.gameState.players.forEach(player => {
        player.pokemon.active.hp = player.pokemon.active.maxHP;
        player.pokemon.active.status = 'active';
        player.pokemon.bench.hp = player.pokemon.bench.maxHP;
        player.pokemon.bench.status = 'benched';
        player.koCount = 0;
        player.canUseCheer = false;
        player.hasUsedGX = false;
        player.lastAction = null;
      });
  
      // Reset turn manager
      this.gameState.turnManager.initializeTurnOrder();
  
      // Recreate boss attack deck
      this.gameState.bossAttackDeck = this.gameState.createBossAttackDeck();
      this.gameState.bossAttackDiscard = [];
  
      return {
        success: true,
        message: 'Game reset by ' + this.gameState.players.get(playerId).username,
        newGameState: this.gameState.getGameState()
      };
    }
  
    async handleJoinAsSpectator(playerId, action) {
      const player = this.gameState.players.get(playerId);
      if (!player) {
        return { success: false, error: 'Player not found' };
      }
  
      // Convert player to spectator
      const spectatorResult = this.gameState.spectatorManager.convertPlayerToSpectator(playerId);
      
      if (!spectatorResult.success) {
        return spectatorResult;
      }
  
      // Remove from turn order
      this.gameState.turnManager.removeFromTurnOrder(playerId);
  
      return {
        success: true,
        isSpectator: true,
        spectatorInfo: spectatorResult.spectator,
        message: `${player.username} joined as spectator`
      };
    }
  
    async handleSpectatorChat(playerId, action) {
      const { message } = action;
      
      const chatResult = this.gameState.spectatorManager.processSpectatorChat(playerId, message);
      
      return chatResult;
    }
  
    // ================ BOSS TURN AUTOMATION ================
  
    async processBossTurn() {
      if (this.gameState.gamePhase !== 'playing') return;
      
      console.log('Processing boss turn...');
      
      // Update turn indicator to show boss turn
      this.queueBroadcast('turnEvent', {
        turnIndicator: this.gameState.turnManager.generateTurnIndicator(),
        phase: 'bossTurn'
      });
  
      const bossResult = this.gameState.processBossTurn();
      
      if (bossResult.success) {
        // Broadcast boss actions
        this.queueBroadcast('bossActionsCompleted', {
          attacks: bossResult.attacks,
          totalKOCount: bossResult.totalKOCount,
          nextTurn: bossResult.nextTurn
        });
  
        // Check loss condition
        if (this.gameState.totalKOCount >= this.gameState.maxKOCount) {
          this.gameState.gamePhase = 'defeat';
          this.queueBroadcast('gameEnded', {
            victory: false,
            reason: 'Too many Pokemon KO\'d',
            totalKOs: this.gameState.totalKOCount
          });
        }
      }
    }
  
    // ================ VALIDATION ================
  
    validateAction(action) {
      if (!action || !action.type) {
        return { valid: false, error: 'Action must have a type' };
      }
  
      const requiredFields = this.validActions[action.type];
      if (!requiredFields) {
        return { valid: false, error: `Invalid action type: ${action.type}` };
      }
  
      for (const field of requiredFields) {
        if (action[field] === undefined || action[field] === null) {
          return { valid: false, error: `Missing required field: ${field}` };
        }
      }
  
      return { valid: true };
    }
  
    checkPlayerPermissions(playerId, action) {
      const player = this.gameState.players.get(playerId);
      const spectator = this.gameState.spectatorManager.getSpectatorById(playerId);
  
      // Spectator-only actions
      if (action.type === 'spectatorChat') {
        if (!spectator) {
          return { allowed: false, error: 'Must be a spectator to chat' };
        }
        return { allowed: true };
      }
  
      // Game control actions (anyone can use)
      if (['resetGame', 'joinAsSpectator'].includes(action.type)) {
        return { allowed: true };
      }
  
      // Player-only actions
      if (!player || player.status !== 'active') {
        return { allowed: false, error: 'Must be an active player' };
      }
  
      // Check game phase
      if (this.gameState.gamePhase !== 'playing' && !['resetGame', 'testKO'].includes(action.type)) {
        return { allowed: false, error: 'Game is not active' };
      }
  
      return { allowed: true };
    }
  
    // ================ EVENT MANAGEMENT ================
  
    queueBroadcast(eventType, data) {
      if (!this.gameState.eventQueue) {
        this.gameState.eventQueue = [];
      }
  
      this.gameState.eventQueue.push({
        type: eventType,
        data: data,
        timestamp: Date.now()
      });
    }
  
    async postProcessAction(playerId, action, result) {
      // Update last action timestamp
      this.gameState.lastUpdate = Date.now();
  
      // Queue game state update for all clients
      this.queueBroadcast('gameStateUpdate', {
        gameState: this.gameState.getGameState(),
        lastAction: {
          playerId: playerId,
          action: action,
          result: result,
          timestamp: Date.now()
        }
      });
  
      // Log action for spectators and replay
      if (this.gameState.spectatorManager) {
        this.gameState.spectatorManager.logEvent({
          type: 'playerAction',
          playerId: playerId,
          action: action,
          result: result,
          timestamp: Date.now()
        });
      }
    }
  
    // ================ STATE MANAGEMENT ================
  
    getActionHandlerState() {
      return {
        actionQueueLength: this.actionQueue.length,
        processingActions: this.processingActions,
        validActionTypes: Object.keys(this.validActions),
        lastProcessedAction: this.gameState.lastUpdate
      };
    }
  }