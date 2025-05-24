// ===================================================================
// File: server/raid/types/TurnManager.js
// Path: /server/raid/types/TurnManager.js
// Location: Server-side turn management and indicator system
// Changes: Initial implementation with dynamic turn bar
// Dependencies: TCGOfficialGameState.js
// Dependents: ../core/RaidSocketHandler.js, client-side TurnIndicator
// Changelog: 
//   v1.0.0 - Initial turn order and phase management
//   v1.0.1 - Added dynamic turn indicator bar system
//   v1.0.2 - Added player color coordination and scaling
// Version: 1.0.2
// ===================================================================

export class TurnManager {
    constructor(gameState) {
      this.gameState = gameState;
      this.turnOrder = [];
      this.currentTurnIndex = 0;
      this.currentPhase = 'playerTurns'; // playerTurns, bossTurn, endPhase
      this.currentStage = 1; // 1: action, 2: endTurn, 3: nextPlayer/boss
      
      // Turn indicator settings
      this.indicatorSettings = {
        showNextPlayer: true,
        showPreviousPlayer: true,
        showStageDetails: true,
        autoAdvanceSpeed: 1000, // ms between auto-advance steps
        playerColors: [
          '#3498db', // Blue
          '#e74c3c', // Red  
          '#2ecc71', // Green
          '#f39c12'  // Orange
        ]
      };
      
      this.turnHistory = [];
      this.maxHistorySize = 20;
      this.lastTurnUpdate = Date.now();
      
      this.initializeTurnOrder();
    }
  
    // ================ INITIALIZATION ================
  
    initializeTurnOrder() {
      // Only include active players in turn order
      this.turnOrder = Array.from(this.gameState.players.entries())
        .filter(([id, player]) => player.status === 'active')
        .map(([id, player]) => ({
          playerId: id,
          username: player.username,
          color: this.assignPlayerColor(id),
          active: true,
          turnsCompleted: 0
        }));
  
      this.currentTurnIndex = 0;
      this.currentPhase = 'playerTurns';
      this.currentStage = 1;
      
      this.logTurnEvent('turnOrderInitialized', {
        players: this.turnOrder.length,
        order: this.turnOrder.map(p => p.username)
      });
    }
  
    assignPlayerColor(playerId) {
      const playerIds = Array.from(this.gameState.players.keys());
      const index = playerIds.indexOf(playerId);
      return this.indicatorSettings.playerColors[index % this.indicatorSettings.playerColors.length];
    }
  
    // ================ TURN MANAGEMENT ================
  
    getCurrentPlayer() {
      if (this.currentPhase !== 'playerTurns' || this.turnOrder.length === 0) {
        return null;
      }
      return this.turnOrder[this.currentTurnIndex]?.playerId;
    }
  
    getCurrentTurnInfo() {
      const turnInfo = {
        phase: this.currentPhase,
        stage: this.currentStage,
        currentPlayer: null,
        nextPlayer: null,
        previousPlayer: null,
        totalPlayers: this.turnOrder.length,
        turnIndex: this.currentTurnIndex,
        indicator: this.generateTurnIndicator(),
        timestamp: Date.now()
      };
  
      if (this.currentPhase === 'playerTurns' && this.turnOrder.length > 0) {
        const currentPlayerInfo = this.turnOrder[this.currentTurnIndex];
        turnInfo.currentPlayer = {
          ...currentPlayerInfo,
          stageDescription: this.getStageDescription(this.currentStage)
        };
  
        // Next player info
        const nextIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
        if (nextIndex !== this.currentTurnIndex) {
          turnInfo.nextPlayer = this.turnOrder[nextIndex];
        } else if (this.turnOrder.length === 1) {
          turnInfo.nextPhase = 'bossTurn';
        }
  
        // Previous player info  
        const prevIndex = this.currentTurnIndex === 0 ? 
          this.turnOrder.length - 1 : this.currentTurnIndex - 1;
        if (this.turnOrder.length > 1) {
          turnInfo.previousPlayer = this.turnOrder[prevIndex];
        }
      }
  
      return turnInfo;
    }
  
    getStageDescription(stage) {
      switch (stage) {
        case 1: return 'Choose Action';
        case 2: return 'Resolve Action'; 
        case 3: return 'End Turn';
        default: return 'Unknown';
      }
    }
  
    // ================ TURN INDICATOR SYSTEM ================
  
    generateTurnIndicator() {
      const indicator = {
        type: 'dynamic',
        layout: 'horizontal', // horizontal, vertical, circular
        elements: [],
        settings: this.indicatorSettings
      };
  
      if (this.currentPhase === 'playerTurns') {
        indicator.elements = this.generatePlayerTurnIndicator();
      } else if (this.currentPhase === 'bossTurn') {
        indicator.elements = this.generateBossTurnIndicator();
      }
  
      return indicator;
    }
  
    generatePlayerTurnIndicator() {
      const elements = [];
      
      // Add each player to the indicator
      this.turnOrder.forEach((player, index) => {
        const isCurrent = index === this.currentTurnIndex;
        const isPrevious = index === (this.currentTurnIndex === 0 ? 
          this.turnOrder.length - 1 : this.currentTurnIndex - 1);
        const isNext = index === (this.currentTurnIndex + 1) % this.turnOrder.length;
  
        elements.push({
          type: 'player',
          id: player.playerId,
          username: player.username,
          color: player.color,
          status: isCurrent ? 'current' : isPrevious ? 'previous' : isNext ? 'next' : 'waiting',
          stage: isCurrent ? this.currentStage : 0,
          stageDescription: isCurrent ? this.getStageDescription(this.currentStage) : '',
          turnsCompleted: player.turnsCompleted,
          position: index,
          opacity: isCurrent ? 1.0 : isNext ? 0.7 : isPrevious ? 0.5 : 0.3
        });
  
        // Add stage indicators for current player
        if (isCurrent && this.indicatorSettings.showStageDetails) {
          for (let stage = 1; stage <= 3; stage++) {
            elements.push({
              type: 'stage',
              parentPlayer: player.playerId,
              stage: stage,
              description: this.getStageDescription(stage),
              status: stage < this.currentStage ? 'completed' : 
                     stage === this.currentStage ? 'current' : 'upcoming',
              position: `${index}.${stage}`
            });
          }
        }
      });
  
      // Add transition indicator to boss turn
      if (this.shouldShowBossTransition()) {
        elements.push({
          type: 'transition',
          from: 'playerTurns',
          to: 'bossTurn',
          status: 'upcoming',
          description: 'Boss Turn Next'
        });
      }
  
      return elements;
    }
  
    generateBossTurnIndicator() {
      const elements = [];
      
      elements.push({
        type: 'boss',
        id: 'boss',
        name: this.gameState.boss.card.name,
        color: '#e74c3c',
        status: 'current',
        stage: 1, // Boss turns are simpler
        stageDescription: 'Boss Acting',
        attacksRemaining: this.gameState.boss.maxAttacksPerTurn - this.gameState.boss.attacksThisTurn,
        maxAttacks: this.gameState.boss.maxAttacksPerTurn
      });
  
      // Show return to player turns
      elements.push({
        type: 'transition', 
        from: 'bossTurn',
        to: 'playerTurns',
        status: 'upcoming',
        description: 'Return to Players',
        nextPlayer: this.turnOrder.length > 0 ? this.turnOrder[0].username : 'None'
      });
  
      return elements;
    }
  
    shouldShowBossTransition() {
      // Show boss transition when last player is on their final stage
      const isLastPlayer = this.currentTurnIndex === this.turnOrder.length - 1;
      const isLastStage = this.currentStage === 3;
      return isLastPlayer && isLastStage;
    }
  
    // ================ TURN ADVANCEMENT ================
  
    advanceTurn() {
      this.lastTurnUpdate = Date.now();
  
      if (this.currentPhase === 'playerTurns') {
        return this.advancePlayerTurn();
      } else if (this.currentPhase === 'bossTurn') {
        return this.advanceToBossEnd();
      }
    }
  
    advancePlayerTurn() {
      if (this.currentStage < 3) {
        // Advance stage within current player's turn
        this.currentStage++;
        
        this.logTurnEvent('stageAdvanced', {
          player: this.getCurrentPlayer(),
          stage: this.currentStage,
          description: this.getStageDescription(this.currentStage)
        });
        
        return this.getCurrentTurnInfo();
      } else {
        // Move to next player or boss turn
        return this.advanceToNextPlayer();
      }
    }
  
    advanceToNextPlayer() {
      // Mark current player turn as completed
      if (this.turnOrder[this.currentTurnIndex]) {
        this.turnOrder[this.currentTurnIndex].turnsCompleted++;
      }
      
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
      this.currentStage = 1;
  
      // Check if we've completed a full round (boss turn time)
      if (this.currentTurnIndex === 0) {
        this.currentPhase = 'bossTurn';
        
        this.logTurnEvent('phaseChange', {
          from: 'playerTurns',
          to: 'bossTurn'
        });
      } else {
        this.logTurnEvent('playerChange', {
          newPlayer: this.getCurrentPlayer(),
          playerIndex: this.currentTurnIndex
        });
      }
  
      return this.getCurrentTurnInfo();
    }
  
    advanceToBossEnd() {
      // Boss turn complete, return to player turns
      this.currentPhase = 'playerTurns';
      this.currentTurnIndex = 0; // Start fresh round
      this.currentStage = 1;
  
      this.logTurnEvent('phaseChange', {
        from: 'bossTurn', 
        to: 'playerTurns',
        startingPlayer: this.getCurrentPlayer()
      });
  
      return this.getCurrentTurnInfo();
    }
  
    // ================ PLAYER MANAGEMENT ================
  
    removeFromTurnOrder(playerId) {
      const playerIndex = this.turnOrder.findIndex(p => p.playerId === playerId);
      if (playerIndex === -1) return false;
  
      const removedPlayer = this.turnOrder[playerIndex];
      this.turnOrder.splice(playerIndex, 1);
  
      // Adjust current turn index if needed
      if (playerIndex < this.currentTurnIndex) {
        this.currentTurnIndex--;
      } else if (playerIndex === this.currentTurnIndex && this.turnOrder.length > 0) {
        // Current player was removed, adjust to stay in bounds
        this.currentTurnIndex = this.currentTurnIndex % this.turnOrder.length;
      }
  
      // If no players left, end game
      if (this.turnOrder.length === 0) {
        this.currentPhase = 'endPhase';
      }
  
      this.logTurnEvent('playerRemoved', {
        removedPlayer: removedPlayer.username,
        playersRemaining: this.turnOrder.length,
        newCurrentPlayer: this.getCurrentPlayer()
      });
  
      return true;
    }
  
    addToTurnOrder(playerId, username) {
      // Add new player to end of turn order
      const newPlayer = {
        playerId: playerId,
        username: username,
        color: this.assignPlayerColor(playerId),
        active: true,
        turnsCompleted: 0
      };
  
      this.turnOrder.push(newPlayer);
  
      this.logTurnEvent('playerAdded', {
        newPlayer: username,
        totalPlayers: this.turnOrder.length
      });
  
      return true;
    }
  
    // ================ HISTORY & LOGGING ================
  
    logTurnEvent(type, data) {
      const event = {
        type: type,
        data: data,
        timestamp: Date.now(),
        turnInfo: {
          phase: this.currentPhase,
          stage: this.currentStage,
          player: this.getCurrentPlayer()
        }
      };
  
      this.turnHistory.push(event);
  
      if (this.turnHistory.length > this.maxHistorySize) {
        this.turnHistory = this.turnHistory.slice(-this.maxHistorySize);
      }
  
      // Queue for broadcast to clients
      this.gameState.eventQueue = this.gameState.eventQueue || [];
      this.gameState.eventQueue.push({
        type: 'turnEvent',
        event: event,
        turnIndicator: this.generateTurnIndicator()
      });
    }
  
    getTurnHistory(count = 5) {
      return this.turnHistory.slice(-count);
    }
  
    // ================ CONFIGURATION ================
  
    updateIndicatorSettings(newSettings) {
      this.indicatorSettings = { ...this.indicatorSettings, ...newSettings };
      
      this.logTurnEvent('settingsChanged', {
        newSettings: this.indicatorSettings
      });
    }
  
    // ================ STATE EXPORT ================
  
    getTurnManagerState() {
      return {
        turnOrder: this.turnOrder,
        currentTurnIndex: this.currentTurnIndex,
        currentPhase: this.currentPhase,
        currentStage: this.currentStage,
        currentPlayer: this.getCurrentPlayer(),
        turnInfo: this.getCurrentTurnInfo(),
        indicator: this.generateTurnIndicator(),
        settings: this.indicatorSettings,
        history: this.getTurnHistory(),
        lastUpdate: this.lastTurnUpdate
      };
    }
  }