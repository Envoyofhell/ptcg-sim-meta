// ===================================================================
// File: server/raid/core/RaidTurnManager.js
// Path: /server/raid/core/RaidTurnManager.js
// Purpose: Advanced turn management and game flow control for raid battles
// Version: 1.0.0
//
// Dependencies:
//   - None (pure game flow logic)
//
// Used By:
//   - ./RaidGameEngine.js
//   - ./RaidBossAI.js
//
// Changelog:
//   v1.0.0 - Initial implementation with dynamic turn order
// ===================================================================

export class RaidTurnManager {
  constructor() {
    this.state = {
      currentPhase: 'lobby', // lobby, player_turns, boss_turn, victory, defeat
      turnOrder: [],
      currentTurnIndex: 0,
      round: 0,
      turnTimeoutMs: 30000, // 30 seconds per turn

      // Turn tracking
      activeTurn: null,
      turnStartTime: null,
      turnHistory: [],
      skippedTurns: new Map(),

      // Boss turn management
      bossActionsThisTurn: 0,
      maxBossActionsPerTurn: 1,

      // Round management
      playersActedThisRound: new Set(),
      roundStartTime: null,
    };

    this.turnEvents = [];
    console.log('[RaidTurnManager] Initialized');
  }

  // ================ TURN INITIALIZATION ================

  startTurn(players) {
    this.state.currentPhase = 'player_turns';
    this.state.round = 1;
    this.state.roundStartTime = Date.now();

    // Initialize turn order
    this.state.turnOrder = Array.from(players.keys());
    this.shuffleTurnOrder(); // Randomize initial order

    this.state.currentTurnIndex = 0;
    this.startPlayerTurn();

    this.queueEvent('turnOrderSet', {
      turnOrder: this.state.turnOrder,
      round: this.state.round,
    });

    console.log(
      `[RaidTurnManager] Started turn system with ${this.state.turnOrder.length} players`
    );
    return this.getCurrentTurnState();
  }

  startPlayerTurn() {
    if (this.state.turnOrder.length === 0) {
      return this.startBossTurn();
    }

    const currentPlayerId = this.getCurrentPlayerId();
    if (!currentPlayerId) {
      return this.advanceToNextTurn();
    }

    this.state.activeTurn = {
      type: 'player',
      playerId: currentPlayerId,
      startTime: Date.now(),
      actions: [],
      canAct: true,
    };

    this.state.turnStartTime = Date.now();

    // Set timeout for turn
    this.setTurnTimeout();

    this.queueEvent('playerTurnStart', {
      playerId: currentPlayerId,
      turnIndex: this.state.currentTurnIndex,
      timeLimit: this.state.turnTimeoutMs,
    });

    console.log(`[RaidTurnManager] Started turn for player ${currentPlayerId}`);
    return this.getCurrentTurnState();
  }

  startBossTurn() {
    this.state.currentPhase = 'boss_turn';
    this.state.activeTurn = {
      type: 'boss',
      startTime: Date.now(),
      actions: [],
      actionsRemaining: this.calculateBossActions(),
    };

    this.state.bossActionsThisTurn = 0;
    this.state.turnStartTime = Date.now();

    this.queueEvent('bossTurnStart', {
      round: this.state.round,
      actionsThisTurn: this.state.activeTurn.actionsRemaining,
    });

    console.log(
      `[RaidTurnManager] Started boss turn (${this.state.activeTurn.actionsRemaining} actions)`
    );
    return this.getCurrentTurnState();
  }

  // ================ TURN ADVANCEMENT ================

  advanceToNextTurn() {
    const currentTurn = this.state.activeTurn;

    if (currentTurn) {
      // Record turn in history
      this.recordTurnInHistory(currentTurn);

      if (currentTurn.type === 'player') {
        this.state.playersActedThisRound.add(currentTurn.playerId);
        this.state.currentTurnIndex++;

        // Check if all players have acted this round
        if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
          return this.startBossTurn();
        } else {
          return this.startPlayerTurn();
        }
      } else if (currentTurn.type === 'boss') {
        return this.startNextRound();
      }
    }

    return this.getCurrentTurnState();
  }

  startNextRound() {
    this.state.round++;
    this.state.currentTurnIndex = 0;
    this.state.currentPhase = 'player_turns';
    this.state.playersActedThisRound.clear();
    this.state.roundStartTime = Date.now();

    // Optionally shuffle turn order for variety
    if (this.state.round % 3 === 0) {
      // Every 3 rounds
      this.shuffleTurnOrder();
    }

    this.queueEvent('newRound', {
      round: this.state.round,
      turnOrder: this.state.turnOrder,
    });

    console.log(`[RaidTurnManager] Starting round ${this.state.round}`);
    return this.startPlayerTurn();
  }

  forceNextTurn() {
    console.log('[RaidTurnManager] Forcing turn advancement');
    this.clearTurnTimeout();
    return this.advanceToNextTurn();
  }

  // ================ PLAYER MANAGEMENT ================

  addPlayer(playerId) {
    if (!this.state.turnOrder.includes(playerId)) {
      this.state.turnOrder.push(playerId);

      this.queueEvent('playerAdded', {
        playerId: playerId,
        position: this.state.turnOrder.length - 1,
      });

      console.log(`[RaidTurnManager] Added player ${playerId} to turn order`);
    }
  }

  removePlayer(playerId) {
    const index = this.state.turnOrder.indexOf(playerId);
    if (index !== -1) {
      this.state.turnOrder.splice(index, 1);

      // Adjust current turn index if needed
      if (index <= this.state.currentTurnIndex) {
        this.state.currentTurnIndex = Math.max(
          0,
          this.state.currentTurnIndex - 1
        );
      }

      this.state.playersActedThisRound.delete(playerId);
      this.state.skippedTurns.delete(playerId);

      this.queueEvent('playerRemoved', { playerId: playerId });

      // If it was current player's turn, advance
      if (
        this.state.activeTurn?.type === 'player' &&
        this.state.activeTurn.playerId === playerId
      ) {
        this.advanceToNextTurn();
      }

      console.log(
        `[RaidTurnManager] Removed player ${playerId} from turn order`
      );
    }
  }

  // ================ ACTION PROCESSING ================

  processPlayerAction(playerId, action) {
    const currentTurn = this.state.activeTurn;

    if (
      !currentTurn ||
      currentTurn.type !== 'player' ||
      currentTurn.playerId !== playerId
    ) {
      return { success: false, error: 'Not your turn' };
    }

    if (!currentTurn.canAct) {
      return { success: false, error: 'Cannot act this turn' };
    }

    // Record action
    currentTurn.actions.push({
      action: action,
      timestamp: Date.now(),
    });

    // Determine if turn should end
    const shouldEndTurn = this.shouldEndPlayerTurn(action, currentTurn);

    if (shouldEndTurn) {
      currentTurn.canAct = false;
      this.clearTurnTimeout();

      // Small delay before advancing turn for better UX
      setTimeout(() => {
        this.advanceToNextTurn();
      }, 1000);
    }

    return { success: true, turnEnding: shouldEndTurn };
  }

  processBossAction(bossAction) {
    const currentTurn = this.state.activeTurn;

    if (!currentTurn || currentTurn.type !== 'boss') {
      return { success: false, error: 'Not boss turn' };
    }

    // Record action
    currentTurn.actions.push({
      action: bossAction,
      timestamp: Date.now(),
    });

    this.state.bossActionsThisTurn++;
    currentTurn.actionsRemaining--;

    // Check if boss turn should end
    if (currentTurn.actionsRemaining <= 0) {
      setTimeout(() => {
        this.advanceToNextTurn();
      }, 2000); // Longer delay for boss turns
    }

    return { success: true, actionsRemaining: currentTurn.actionsRemaining };
  }

  // ================ TURN LOGIC ================

  shouldEndPlayerTurn(action, currentTurn) {
    // End turn on attack or retreat
    if (action.type === 'attack' || action.type === 'retreat') {
      return true;
    }

    // End turn if player has taken multiple actions
    if (currentTurn.actions.length >= 2) {
      return true;
    }

    // Don't end turn on cheer cards, debug actions, etc.
    return false;
  }

  calculateBossActions() {
    // Boss gets more actions in later rounds and based on remaining players
    const baseActions = 1;
    const roundBonus = Math.floor(this.state.round / 3);
    const playerCountBonus = Math.max(0, this.state.turnOrder.length - 2);

    return Math.min(baseActions + roundBonus + playerCountBonus, 4);
  }

  skipPlayerTurn(playerId, reason = 'timeout') {
    if (!this.state.skippedTurns.has(playerId)) {
      this.state.skippedTurns.set(playerId, 0);
    }

    const skipCount = this.state.skippedTurns.get(playerId) + 1;
    this.state.skippedTurns.set(playerId, skipCount);

    this.queueEvent('turnSkipped', {
      playerId: playerId,
      reason: reason,
      skipCount: skipCount,
    });

    // Auto-kick players who skip too many turns
    if (skipCount >= 3) {
      this.queueEvent('playerAutoKicked', {
        playerId: playerId,
        reason: 'Too many skipped turns',
      });
    }

    console.log(
      `[RaidTurnManager] Player ${playerId} skipped turn (${reason}). Count: ${skipCount}`
    );
  }

  // ================ UTILITY METHODS ================

  getCurrentPlayerId() {
    if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
      return null;
    }
    return this.state.turnOrder[this.state.currentTurnIndex];
  }

  getCurrentTurnState() {
    return {
      phase: this.state.currentPhase,
      round: this.state.round,
      currentPlayer: this.getCurrentPlayerId(),
      turnOrder: [...this.state.turnOrder],
      turnIndex: this.state.currentTurnIndex,
      activeTurn: this.state.activeTurn ? { ...this.state.activeTurn } : null,
      timeRemaining: this.getTurnTimeRemaining(),
      playersActedThisRound: Array.from(this.state.playersActedThisRound),
    };
  }

  getTurnTimeRemaining() {
    if (!this.state.turnStartTime) return 0;

    const elapsed = Date.now() - this.state.turnStartTime;
    return Math.max(0, this.state.turnTimeoutMs - elapsed);
  }

  isPlayerTurn(playerId) {
    return (
      this.state.activeTurn?.type === 'player' &&
      this.state.activeTurn.playerId === playerId
    );
  }

  isBossTurn() {
    return this.state.currentPhase === 'boss_turn';
  }

  shuffleTurnOrder() {
    for (let i = this.state.turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.state.turnOrder[i], this.state.turnOrder[j]] = [
        this.state.turnOrder[j],
        this.state.turnOrder[i],
      ];
    }
  }

  recordTurnInHistory(turn) {
    const turnRecord = {
      ...turn,
      endTime: Date.now(),
      duration: Date.now() - turn.startTime,
      round: this.state.round,
    };

    this.state.turnHistory.push(turnRecord);

    // Keep only last 20 turns in history
    if (this.state.turnHistory.length > 20) {
      this.state.turnHistory.shift();
    }
  }

  // ================ TIMEOUT MANAGEMENT ================

  setTurnTimeout() {
    this.clearTurnTimeout();

    this.turnTimeoutId = setTimeout(() => {
      const currentPlayerId = this.getCurrentPlayerId();
      if (currentPlayerId) {
        this.skipPlayerTurn(currentPlayerId, 'timeout');
        this.advanceToNextTurn();
      }
    }, this.state.turnTimeoutMs);
  }

  clearTurnTimeout() {
    if (this.turnTimeoutId) {
      clearTimeout(this.turnTimeoutId);
      this.turnTimeoutId = null;
    }
  }

  // ================ EVENT SYSTEM ================

  queueEvent(type, data) {
    this.turnEvents.push({
      type: type,
      data: data,
      timestamp: Date.now(),
    });
  }

  consumeEvents() {
    const events = [...this.turnEvents];
    this.turnEvents = [];
    return events;
  }

  // ================ GAME STATE MANAGEMENT ================

  endGame(result) {
    this.state.currentPhase = result === 'victory' ? 'victory' : 'defeat';
    this.clearTurnTimeout();

    this.queueEvent('gameEnded', {
      result: result,
      finalRound: this.state.round,
      duration: Date.now() - this.state.roundStartTime,
    });

    console.log(`[RaidTurnManager] Game ended: ${result}`);
  }

  resetGame() {
    this.clearTurnTimeout();

    this.state = {
      currentPhase: 'lobby',
      turnOrder: [],
      currentTurnIndex: 0,
      round: 0,
      turnTimeoutMs: 30000,
      activeTurn: null,
      turnStartTime: null,
      turnHistory: [],
      skippedTurns: new Map(),
      bossActionsThisTurn: 0,
      maxBossActionsPerTurn: 1,
      playersActedThisRound: new Set(),
      roundStartTime: null,
    };

    this.turnEvents = [];
    console.log('[RaidTurnManager] Game state reset');
  }

  // ================ DEBUG METHODS ================

  forceTurn(playerId) {
    const playerIndex = this.state.turnOrder.indexOf(playerId);
    if (playerIndex !== -1) {
      this.state.currentTurnIndex = playerIndex;
      this.clearTurnTimeout();
      this.startPlayerTurn();

      console.log(`[RaidTurnManager] Forced turn to player ${playerId}`);
      return true;
    }
    return false;
  }

  setTurnTimeout(timeoutMs) {
    this.state.turnTimeoutMs = timeoutMs;
    console.log(`[RaidTurnManager] Turn timeout set to ${timeoutMs}ms`);
  }

  getTurnHistory() {
    return [...this.state.turnHistory];
  }

  getTurnStats() {
    const stats = {
      totalTurns: this.state.turnHistory.length,
      currentRound: this.state.round,
      averageTurnTime: 0,
      playerStats: {},
    };

    if (this.state.turnHistory.length > 0) {
      const totalTime = this.state.turnHistory.reduce(
        (sum, turn) => sum + turn.duration,
        0
      );
      stats.averageTurnTime = totalTime / this.state.turnHistory.length;
    }

    // Calculate per-player stats
    this.state.turnOrder.forEach((playerId) => {
      const playerTurns = this.state.turnHistory.filter(
        (t) => t.playerId === playerId
      );
      stats.playerStats[playerId] = {
        totalTurns: playerTurns.length,
        totalActions: playerTurns.reduce(
          (sum, turn) => sum + turn.actions.length,
          0
        ),
        averageTime:
          playerTurns.length > 0
            ? playerTurns.reduce((sum, turn) => sum + turn.duration, 0) /
              playerTurns.length
            : 0,
        skippedTurns: this.state.skippedTurns.get(playerId) || 0,
      };
    });

    return stats;
  }
}
