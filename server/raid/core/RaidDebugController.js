// ===================================================================
// File: server/raid/core/RaidDebugController.js
// Path: /server/raid/core/RaidDebugController.js
// Purpose: Debug interface and testing utilities for raid system
// Version: 1.0.0
//
// Dependencies:
//   - ./RaidGameEngine.js
//   - ./RaidCombatSystem.js
//   - ./RaidTurnManager.js
//
// Used By:
//   - ../../raid-test-server-enhanced.js
//   - Debug clients
//
// Changelog:
//   v1.0.0 - Initial implementation with comprehensive debug tools
// ===================================================================

export class RaidDebugController {
  constructor(gameEngine) {
    this.gameEngine = gameEngine;
    this.debugState = {
      enabled: false,
      logLevel: 'info', // debug, info, warn, error
      captureEvents: true,
      eventHistory: [],
      commandHistory: [],
    };

    this.debugCommands = new Map();
    this.initializeCommands();

    console.log('[RaidDebugController] Initialized');
  }

  // ================ INITIALIZATION ================

  initializeCommands() {
    // Game state commands
    this.registerCommand('status', this.getSystemStatus.bind(this));
    this.registerCommand('state', this.getGameState.bind(this));
    this.registerCommand('players', this.getPlayerInfo.bind(this));
    this.registerCommand('boss', this.getBossInfo.bind(this));

    // Player manipulation
    this.registerCommand('set-hp', this.setPlayerHP.bind(this));
    this.registerCommand('heal', this.healPlayer.bind(this));
    this.registerCommand('ko', this.koPlayer.bind(this));
    this.registerCommand('revive', this.revivePlayer.bind(this));

    // Boss manipulation
    this.registerCommand('set-boss-hp', this.setBossHP.bind(this));
    this.registerCommand('boss-attack', this.forceBossAttack.bind(this));
    this.registerCommand('boss-ai', this.setBossAI.bind(this));

    // Turn management
    this.registerCommand('force-turn', this.forceTurn.bind(this));
    this.registerCommand('skip-turn', this.skipTurn.bind(this));
    this.registerCommand('end-round', this.endRound.bind(this));

    // Game flow
    this.registerCommand('start-game', this.startGame.bind(this));
    this.registerCommand('end-game', this.endGame.bind(this));
    this.registerCommand('reset', this.resetGame.bind(this));

    // Testing
    this.registerCommand('simulate', this.simulateBattle.bind(this));
    this.registerCommand('stress-test', this.stressTest.bind(this));
    this.registerCommand('auto-play', this.autoPlay.bind(this));

    // Debug utilities
    this.registerCommand('log-level', this.setLogLevel.bind(this));
    this.registerCommand('clear-log', this.clearEventHistory.bind(this));
    this.registerCommand('export-state', this.exportGameState.bind(this));
    this.registerCommand('import-state', this.importGameState.bind(this));

    // Help system
    this.registerCommand('help', this.getHelp.bind(this));
    this.registerCommand('commands', this.listCommands.bind(this));
  }

  registerCommand(name, handler) {
    this.debugCommands.set(name, handler);
  }

  // ================ PUBLIC INTERFACE ================

  enable() {
    this.debugState.enabled = true;
    this.log('info', 'Debug mode enabled');
    return { success: true, message: 'Debug mode enabled' };
  }

  disable() {
    this.debugState.enabled = false;
    this.log('info', 'Debug mode disabled');
    return { success: true, message: 'Debug mode disabled' };
  }

  executeCommand(command, args = [], requesterInfo = {}) {
    if (!this.debugState.enabled) {
      return { success: false, error: 'Debug mode not enabled' };
    }

    const commandRecord = {
      command: command,
      args: args,
      timestamp: Date.now(),
      requester: requesterInfo,
    };

    this.debugState.commandHistory.push(commandRecord);

    try {
      const handler = this.debugCommands.get(command);
      if (!handler) {
        return { success: false, error: `Unknown command: ${command}` };
      }

      const result = handler(args);
      commandRecord.result = result;

      this.log('debug', `Command executed: ${command}`, { args, result });
      return result;
    } catch (error) {
      const errorResult = { success: false, error: error.message };
      commandRecord.result = errorResult;

      this.log('error', `Command failed: ${command}`, { error: error.message });
      return errorResult;
    }
  }

  // ================ GAME STATE COMMANDS ================

  getSystemStatus() {
    const gameState = this.gameEngine.getGameState();
    const turnState = this.gameEngine.turnManager.getCurrentTurnState();

    return {
      success: true,
      data: {
        gamePhase: gameState.phase,
        playerCount: gameState.activePlayers.size,
        spectatorCount: gameState.spectators.size,
        bossHP: `${gameState.boss.currentHP}/${gameState.boss.maxHP}`,
        currentRound: turnState.round,
        currentPlayer: turnState.currentPlayer,
        debugMode: this.debugState.enabled,
        uptime: Date.now() - (gameState.lastUpdate || Date.now()),
      },
    };
  }

  getGameState() {
    return {
      success: true,
      data: this.gameEngine.getGameState(),
    };
  }

  getPlayerInfo(args) {
    const gameState = this.gameEngine.getGameState();

    if (args.length > 0) {
      // Get specific player
      const playerId = args[0];
      const player = gameState.activePlayers.get(playerId);

      if (!player) {
        return { success: false, error: `Player ${playerId} not found` };
      }

      return {
        success: true,
        data: {
          player: player,
          isCurrentTurn: this.gameEngine.turnManager.isPlayerTurn(playerId),
          turnStats:
            this.gameEngine.turnManager.getTurnStats().playerStats[playerId],
        },
      };
    } else {
      // Get all players
      const players = Array.from(gameState.activePlayers.values());
      return {
        success: true,
        data: {
          players: players,
          count: players.length,
        },
      };
    }
  }

  getBossInfo() {
    const gameState = this.gameEngine.getGameState();
    const aiStatus = this.gameEngine.bossAI.getAIStatus();

    return {
      success: true,
      data: {
        boss: gameState.boss,
        aiStatus: aiStatus,
        isBossTurn: this.gameEngine.turnManager.isBossTurn(),
      },
    };
  }

  // ================ PLAYER MANIPULATION ================

  setPlayerHP(args) {
    if (args.length < 2) {
      return { success: false, error: 'Usage: set-hp <playerId> <newHP>' };
    }

    const [playerId, newHP] = args;
    const hp = parseInt(newHP);

    if (isNaN(hp) || hp < 0) {
      return { success: false, error: 'Invalid HP value' };
    }

    const gameState = this.gameEngine.getGameState();
    const player = gameState.activePlayers.get(playerId);

    if (!player) {
      return { success: false, error: `Player ${playerId} not found` };
    }

    const oldHP = player.pokemon.active.currentHP;
    player.pokemon.active.currentHP = Math.min(hp, player.pokemon.active.maxHP);

    if (player.pokemon.active.currentHP === 0) {
      player.pokemon.active.status = 'ko';
      player.status = 'ko';
    } else {
      player.pokemon.active.status = 'active';
      player.status = 'active';
    }

    this.log(
      'info',
      `Set ${playerId} HP: ${oldHP} → ${player.pokemon.active.currentHP}`
    );

    return {
      success: true,
      data: {
        playerId: playerId,
        oldHP: oldHP,
        newHP: player.pokemon.active.currentHP,
        isKO: player.pokemon.active.currentHP === 0,
      },
    };
  }

  healPlayer(args) {
    if (args.length < 2) {
      return { success: false, error: 'Usage: heal <playerId> <amount>' };
    }

    const [playerId, healAmount] = args;
    const amount = parseInt(healAmount);

    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Invalid heal amount' };
    }

    const gameState = this.gameEngine.getGameState();
    const player = gameState.activePlayers.get(playerId);

    if (!player) {
      return { success: false, error: `Player ${playerId} not found` };
    }

    const result = this.gameEngine.combatSystem.healPokemon(
      player.pokemon.active,
      amount
    );

    this.log('info', `Healed ${playerId} for ${result.healAmount} HP`);

    return {
      success: true,
      data: result,
    };
  }

  koPlayer(args) {
    if (args.length < 1) {
      return { success: false, error: 'Usage: ko <playerId>' };
    }

    return this.setPlayerHP([args[0], '0']);
  }

  revivePlayer(args) {
    if (args.length < 1) {
      return { success: false, error: 'Usage: revive <playerId> [hp]' };
    }

    const playerId = args[0];
    const hp = args.length > 1 ? parseInt(args[1]) : null;

    const gameState = this.gameEngine.getGameState();
    const player = gameState.activePlayers.get(playerId);

    if (!player) {
      return { success: false, error: `Player ${playerId} not found` };
    }

    const reviveHP = hp || Math.floor(player.pokemon.active.maxHP * 0.5);
    return this.setPlayerHP([playerId, reviveHP.toString()]);
  }

  // ================ BOSS MANIPULATION ================

  setBossHP(args) {
    if (args.length < 1) {
      return { success: false, error: 'Usage: set-boss-hp <newHP>' };
    }

    const newHP = parseInt(args[0]);

    if (isNaN(newHP) || newHP < 0) {
      return { success: false, error: 'Invalid HP value' };
    }

    const gameState = this.gameEngine.getGameState();
    const oldHP = gameState.boss.currentHP;

    gameState.boss.currentHP = Math.min(newHP, gameState.boss.maxHP);

    this.log('info', `Set boss HP: ${oldHP} → ${gameState.boss.currentHP}`);

    return {
      success: true,
      data: {
        oldHP: oldHP,
        newHP: gameState.boss.currentHP,
        isDefeated: gameState.boss.currentHP === 0,
      },
    };
  }

  forceBossAttack(args) {
    if (!this.gameEngine.turnManager.isBossTurn()) {
      return { success: false, error: 'Not boss turn' };
    }

    const attackName = args.length > 0 ? args[0] : null;
    const targetPlayerId = args.length > 1 ? args[1] : null;

    // Trigger boss AI to select action
    const gameState = this.gameEngine.getGameState();
    const players = Array.from(gameState.activePlayers.values());

    let action = this.gameEngine.bossAI.selectAction(
      gameState.boss,
      players,
      gameState
    );

    // Override with specified attack if provided
    if (attackName) {
      const attack = gameState.boss.attacks.find((a) =>
        a.name.toLowerCase().includes(attackName.toLowerCase())
      );

      if (attack) {
        action.attack = attack;
      }
    }

    // Override target if provided
    if (targetPlayerId) {
      const target = gameState.activePlayers.get(targetPlayerId);
      if (target) {
        action.targets = [target];
      }
    }

    const result = this.gameEngine.processBossTurn();

    return {
      success: true,
      data: {
        action: action,
        result: result,
      },
    };
  }

  setBossAI(args) {
    if (args.length < 1) {
      return { success: false, error: 'Usage: boss-ai <strategy>' };
    }

    const strategy = args[0];
    this.gameEngine.bossAI.setStrategy(strategy);

    return {
      success: true,
      data: {
        strategy: strategy,
        aiStatus: this.gameEngine.bossAI.getAIStatus(),
      },
    };
  }

  // ================ TURN MANAGEMENT ================

  forceTurn(args) {
    if (args.length < 1) {
      return { success: false, error: 'Usage: force-turn <playerId>' };
    }

    const playerId = args[0];
    const result = this.gameEngine.turnManager.forceTurn(playerId);

    return {
      success: result,
      data: {
        newCurrentPlayer: this.gameEngine.turnManager.getCurrentPlayerId(),
        turnState: this.gameEngine.turnManager.getCurrentTurnState(),
      },
    };
  }

  skipTurn() {
    const currentPlayer = this.gameEngine.turnManager.getCurrentPlayerId();
    if (!currentPlayer) {
      return { success: false, error: 'No active turn to skip' };
    }

    this.gameEngine.turnManager.forceNextTurn();

    return {
      success: true,
      data: {
        skippedPlayer: currentPlayer,
        newCurrentPlayer: this.gameEngine.turnManager.getCurrentPlayerId(),
      },
    };
  }

  endRound() {
    this.gameEngine.turnManager.startNextRound();

    return {
      success: true,
      data: {
        newRound: this.gameEngine.turnManager.getCurrentTurnState().round,
      },
    };
  }

  // ================ GAME FLOW ================

  startGame() {
    const result = this.gameEngine.startGame();
    return result;
  }

  endGame(args) {
    const result = args.length > 0 ? args[0] : 'victory';
    this.gameEngine.turnManager.endGame(result);

    return {
      success: true,
      data: {
        result: result,
        finalState: this.gameEngine.getGameState(),
      },
    };
  }

  resetGame() {
    // Reset all systems
    this.gameEngine.turnManager.resetGame();
    this.gameEngine.state.phase = 'lobby';
    this.gameEngine.state.activePlayers.clear();
    this.gameEngine.state.spectators.clear();

    this.clearEventHistory();

    return {
      success: true,
      message: 'Game state reset',
    };
  }

  // ================ TESTING ================

  simulateBattle(args) {
    const iterations = args.length > 0 ? parseInt(args[0]) : 100;

    if (isNaN(iterations) || iterations <= 0) {
      return { success: false, error: 'Invalid iteration count' };
    }

    // Run battle simulation
    const results = {
      victories: 0,
      defeats: 0,
      averageRounds: 0,
      averageDuration: 0,
      details: [],
    };

    for (let i = 0; i < iterations; i++) {
      const battleResult = this.runSingleBattleSimulation();
      results.details.push(battleResult);

      if (battleResult.result === 'victory') {
        results.victories++;
      } else {
        results.defeats++;
      }

      results.averageRounds += battleResult.rounds;
      results.averageDuration += battleResult.duration;
    }

    results.averageRounds /= iterations;
    results.averageDuration /= iterations;
    results.winRate = (results.victories / iterations) * 100;

    return {
      success: true,
      data: results,
    };
  }

  stressTest(args) {
    const playerCount = args.length > 0 ? parseInt(args[0]) : 4;
    const actionCount = args.length > 1 ? parseInt(args[1]) : 100;

    const startTime = Date.now();
    const results = {
      actionsProcessed: 0,
      errors: 0,
      averageResponseTime: 0,
      peakMemory: 0,
    };

    // Simulate rapid actions
    for (let i = 0; i < actionCount; i++) {
      const actionStart = performance.now();

      try {
        // Simulate random player action
        const playerId = `player${Math.floor(Math.random() * playerCount)}`;
        const action = this.generateRandomAction();

        this.gameEngine.processAction(playerId, action);
        results.actionsProcessed++;
      } catch (error) {
        results.errors++;
      }

      const actionTime = performance.now() - actionStart;
      results.averageResponseTime += actionTime;
    }

    results.averageResponseTime /= actionCount;
    results.totalDuration = Date.now() - startTime;

    return {
      success: true,
      data: results,
    };
  }

  autoPlay(args) {
    const rounds = args.length > 0 ? parseInt(args[0]) : 5;

    // Auto-play the game for testing
    const startState = this.gameEngine.getGameState();
    const results = [];

    for (let round = 0; round < rounds; round++) {
      const players = Array.from(startState.activePlayers.keys());

      players.forEach((playerId) => {
        const action = this.generateRandomAction();
        const result = this.gameEngine.processAction(playerId, action);
        results.push({ round, playerId, action, result });
      });

      // Process boss turn
      const bossResult = this.gameEngine.processBossTurn();
      results.push({ round, type: 'boss', result: bossResult });
    }

    return {
      success: true,
      data: {
        rounds: rounds,
        actions: results,
        finalState: this.gameEngine.getGameState(),
      },
    };
  }

  // ================ UTILITY METHODS ================

  generateRandomAction() {
    const actions = ['attack', 'cheer', 'retreat'];
    const action = actions[Math.floor(Math.random() * actions.length)];

    switch (action) {
      case 'attack':
        return { type: 'attack', attackIndex: 0 };
      case 'cheer':
        return { type: 'cheer', cheerType: 'damage' };
      case 'retreat':
        return { type: 'retreat' };
      default:
        return { type: 'attack', attackIndex: 0 };
    }
  }

  runSingleBattleSimulation() {
    const startTime = Date.now();
    let rounds = 0;
    let result = 'defeat';

    // Simplified battle simulation
    while (rounds < 20) {
      // Max 20 rounds
      rounds++;

      // Simulate random damage
      const bossHP = this.gameEngine.getGameState().boss.currentHP;
      const damage = Math.floor(Math.random() * 100) + 50;

      if (bossHP - damage <= 0) {
        result = 'victory';
        break;
      }
    }

    return {
      result: result,
      rounds: rounds,
      duration: Date.now() - startTime,
    };
  }

  // ================ DEBUG UTILITIES ================

  setLogLevel(args) {
    if (args.length < 1) {
      return { success: false, error: 'Usage: log-level <level>' };
    }

    const level = args[0].toLowerCase();
    const validLevels = ['debug', 'info', 'warn', 'error'];

    if (!validLevels.includes(level)) {
      return {
        success: false,
        error: `Invalid level. Use: ${validLevels.join(', ')}`,
      };
    }

    this.debugState.logLevel = level;

    return {
      success: true,
      data: { logLevel: level },
    };
  }

  clearEventHistory() {
    this.debugState.eventHistory = [];
    this.debugState.commandHistory = [];

    return {
      success: true,
      message: 'Event history cleared',
    };
  }

  exportGameState() {
    const state = {
      gameState: this.gameEngine.getGameState(),
      turnState: this.gameEngine.turnManager.getCurrentTurnState(),
      debugState: this.debugState,
      timestamp: Date.now(),
    };

    return {
      success: true,
      data: {
        state: state,
        serialized: JSON.stringify(state, null, 2),
      },
    };
  }

  importGameState(args) {
    if (args.length < 1) {
      return { success: false, error: 'Usage: import-state <stateJSON>' };
    }

    try {
      const state = JSON.parse(args[0]);

      // This would require more complex state restoration logic
      // For now, just acknowledge the command

      return {
        success: true,
        message: 'State import not fully implemented',
        data: { importedKeys: Object.keys(state) },
      };
    } catch (error) {
      return { success: false, error: 'Invalid JSON state' };
    }
  }

  // ================ HELP SYSTEM ================

  getHelp(args) {
    if (args.length > 0) {
      const command = args[0];
      return this.getCommandHelp(command);
    }

    return {
      success: true,
      data: {
        message: 'Raid Debug Controller Help',
        categories: {
          'Game State': ['status', 'state', 'players', 'boss'],
          'Player Control': ['set-hp', 'heal', 'ko', 'revive'],
          'Boss Control': ['set-boss-hp', 'boss-attack', 'boss-ai'],
          'Turn Management': ['force-turn', 'skip-turn', 'end-round'],
          'Game Flow': ['start-game', 'end-game', 'reset'],
          Testing: ['simulate', 'stress-test', 'auto-play'],
          'Debug Utils': ['log-level', 'clear-log', 'export-state'],
          Help: ['help', 'commands'],
        },
        usage: 'Use "help <command>" for specific command info',
      },
    };
  }

  listCommands() {
    return {
      success: true,
      data: {
        commands: Array.from(this.debugCommands.keys()).sort(),
        count: this.debugCommands.size,
      },
    };
  }

  getCommandHelp(command) {
    const helpText = {
      status: 'Get system status overview',
      state: 'Get full game state',
      players: 'Get player info [playerId]',
      boss: 'Get boss and AI info',
      'set-hp': 'Set player HP: set-hp <playerId> <newHP>',
      heal: 'Heal player: heal <playerId> <amount>',
      ko: 'KO player: ko <playerId>',
      revive: 'Revive player: revive <playerId> [hp]',
      // ... add more help text as needed
    };

    const help = helpText[command];
    if (!help) {
      return {
        success: false,
        error: `No help available for command: ${command}`,
      };
    }

    return {
      success: true,
      data: {
        command: command,
        help: help,
      },
    };
  }

  // ================ LOGGING ================

  log(level, message, data = null) {
    const logLevels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = logLevels[this.debugState.logLevel] || 1;
    const messageLevel = logLevels[level] || 1;

    if (messageLevel >= currentLevel) {
      const logEntry = {
        level: level,
        message: message,
        data: data,
        timestamp: Date.now(),
      };

      console.log(`[RaidDebug:${level.toUpperCase()}] ${message}`, data || '');

      if (this.debugState.captureEvents) {
        this.debugState.eventHistory.push(logEntry);

        // Keep only last 100 events
        if (this.debugState.eventHistory.length > 100) {
          this.debugState.eventHistory.shift();
        }
      }
    }
  }

  getEventHistory() {
    return {
      success: true,
      data: {
        events: [...this.debugState.eventHistory],
        commands: [...this.debugState.commandHistory],
      },
    };
  }
}
