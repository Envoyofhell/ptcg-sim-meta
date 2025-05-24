// ===================================================================
// File: server/raid/core/RaidGameEngine.js
// Path: /server/raid/core/RaidGameEngine.js
// Purpose: Core game engine for raid battles - manages game state and mechanics
// Version: 1.0.0
//
// Dependencies:
//   - ./RaidCombatSystem.js
//   - ./RaidTurnManager.js
//   - ./RaidBossAI.js
//
// Used By:
//   - ../../raid-test-server-enhanced.js
//   - ./RaidDebugController.js
//
// Changelog:
//   v1.0.0 - Initial implementation with full game state management
// ===================================================================

import { RaidCombatSystem } from './RaidCombatSystem.js';
import { RaidTurnManager } from './RaidTurnManager.js';
import { RaidBossAI } from './RaidBossAI.js';

export class RaidGameEngine {
  constructor(raidId, config) {
    this.raidId = raidId;
    this.config = {
      type: 'tcg-official',
      maxPlayers: 4,
      minPlayers: 1,
      bossLevel: 1,
      ...config,
    };

    // Core systems
    this.combatSystem = new RaidCombatSystem();
    this.turnManager = new RaidTurnManager();
    this.bossAI = new RaidBossAI(this.config.bossLevel);

    // Game state
    this.state = {
      phase: 'lobby', // lobby, playing, bossTurn, victory, defeat
      round: 0,
      totalKOs: 0,
      maxKOs: 4,
      cheerCardsUsed: 0,
      maxCheerCards: 3,
      activePlayers: new Map(),
      spectators: new Map(),
      boss: this.initializeBoss(),
      turnHistory: [],
      lastUpdate: Date.now(),
    };

    // Event queue for broadcasting
    this.eventQueue = [];

    console.log(`[RaidGameEngine] Initialized for raid ${raidId}`);
  }

  // ================ INITIALIZATION ================

  initializeBoss() {
    const bossTemplates = {
      1: {
        name: 'Charizard VMAX',
        maxHP: 800,
        attacks: [
          { name: 'Claw Swipe', damage: 30, targets: 1 },
          { name: 'G-Max Wildfire', damage: 60, targets: 1 },
          { name: 'Explosive Fire', damage: 100, targets: 'all' },
        ],
      },
      2: {
        name: 'Pikachu VMAX',
        maxHP: 1200,
        attacks: [
          { name: 'Thunder Shock', damage: 40, targets: 1 },
          { name: 'G-Max Volt Tackle', damage: 80, targets: 1 },
          { name: 'Lightning Storm', damage: 120, targets: 'all' },
        ],
      },
      3: {
        name: 'Mewtwo VMAX',
        maxHP: 1600,
        attacks: [
          { name: 'Psychic', damage: 50, targets: 1 },
          { name: 'Psystrike', damage: 100, targets: 1 },
          { name: 'Psychic Explosion', damage: 150, targets: 'all' },
        ],
      },
    };

    const template = bossTemplates[this.config.bossLevel] || bossTemplates[1];

    return {
      ...template,
      currentHP: template.maxHP,
      level: this.config.bossLevel,
      status: 'active',
      attacksThisTurn: 0,
      maxAttacksPerTurn: this.config.bossLevel + 1, // 2, 3, or 4 attacks
      statusEffects: [],
    };
  }

  // ================ PLAYER MANAGEMENT ================

  addPlayer(playerId, playerData) {
    if (this.state.phase !== 'lobby') {
      return { success: false, error: 'Game already started' };
    }

    if (this.state.activePlayers.size >= this.config.maxPlayers) {
      return { success: false, error: 'Raid is full' };
    }

    const player = {
      id: playerId,
      username: playerData.username,
      joinedAt: Date.now(),
      status: 'active',
      pokemon: {
        active: {
          name: playerData.activePokemon?.name || 'Pikachu',
          maxHP: playerData.activePokemon?.maxHP || 120,
          currentHP: playerData.activePokemon?.maxHP || 120,
          attacks: playerData.activePokemon?.attacks || [
            { name: 'Thunder Shock', damage: 60 },
          ],
          status: 'active',
        },
        bench: {
          name: playerData.benchPokemon?.name || 'Squirtle',
          maxHP: playerData.benchPokemon?.maxHP || 100,
          currentHP: playerData.benchPokemon?.maxHP || 100,
          attacks: playerData.benchPokemon?.attacks || [
            { name: 'Water Gun', damage: 50 },
          ],
          status: 'benched',
        },
      },
      koCount: 0,
      hasUsedGX: false,
      canUseCheer: false,
    };

    this.state.activePlayers.set(playerId, player);
    this.turnManager.addPlayer(playerId);

    this.queueEvent('playerAdded', { player });

    return { success: true, player };
  }

  removePlayer(playerId) {
    const player = this.state.activePlayers.get(playerId);
    if (!player) return { success: false };

    this.state.activePlayers.delete(playerId);
    this.turnManager.removePlayer(playerId);

    // Convert to spectator if game is active
    if (this.state.phase !== 'lobby') {
      this.state.spectators.set(playerId, {
        ...player,
        status: 'spectator',
        leftAt: Date.now(),
      });
    }

    this.queueEvent('playerRemoved', { playerId, username: player.username });

    return { success: true };
  }

  // ================ GAME FLOW ================

  startGame() {
    if (this.state.activePlayers.size < this.config.minPlayers) {
      return { success: false, error: 'Not enough players' };
    }

    this.state.phase = 'playing';
    this.state.round = 1;
    this.turnManager.startTurn(this.state.activePlayers);

    this.queueEvent('gameStarted', {
      playerCount: this.state.activePlayers.size,
      bossLevel: this.state.boss.level,
    });

    return { success: true };
  }

  // ================ ACTION PROCESSING ================

  processAction(playerId, action) {
    const player = this.state.activePlayers.get(playerId);

    if (!player) {
      // Check if spectator
      if (this.state.spectators.has(playerId)) {
        return this.processSpectatorAction(playerId, action);
      }
      return { success: false, error: 'Player not found' };
    }

    if (this.state.phase !== 'playing') {
      return { success: false, error: 'Game not active' };
    }

    if (!this.turnManager.isPlayerTurn(playerId)) {
      return { success: false, error: 'Not your turn' };
    }

    let result;

    switch (action.type) {
      case 'playerAttack':
        result = this.processAttack(player, action);
        break;

      case 'playerRetreat':
        result = this.processRetreat(player);
        break;

      case 'cheerCard':
        result = this.processCheerCard(player, action);
        break;

      case 'testKO':
        result = this.processTestKO(player, action);
        break;

      case 'endTurn':
        result = this.processEndTurn(player);
        break;

      default:
        result = { success: false, error: 'Unknown action' };
    }

    if (result.success) {
      this.checkGameState();

      // Auto-advance turn if needed
      if (result.endTurn) {
        this.advanceTurn();
      }
    }

    return result;
  }

  processAttack(player, action) {
    const pokemon = player.pokemon.active;
    if (pokemon.status === 'ko') {
      return { success: false, error: "Active Pokemon is KO'd" };
    }

    const attack = pokemon.attacks.find((a) => a.name === action.attackName);
    if (!attack) {
      return { success: false, error: 'Attack not found' };
    }

    const damage = this.combatSystem.calculateDamage(
      attack,
      pokemon,
      this.state.boss
    );
    this.state.boss.currentHP = Math.max(0, this.state.boss.currentHP - damage);

    this.queueEvent('playerAttacked', {
      playerId: player.id,
      username: player.username,
      attackName: attack.name,
      damage: damage,
      bossHP: this.state.boss.currentHP,
      bossMaxHP: this.state.boss.maxHP,
    });

    return {
      success: true,
      damage: damage,
      bossHP: this.state.boss.currentHP,
      endTurn: true,
    };
  }

  processRetreat(player) {
    // Swap active and bench Pokemon
    const temp = player.pokemon.active;
    player.pokemon.active = player.pokemon.bench;
    player.pokemon.bench = temp;

    player.pokemon.active.status = 'active';
    player.pokemon.bench.status = 'benched';

    this.queueEvent('playerRetreated', {
      playerId: player.id,
      username: player.username,
      newActive: player.pokemon.active.name,
    });

    return { success: true, endTurn: false };
  }

  processCheerCard(player, action) {
    if (!player.canUseCheer) {
      return { success: false, error: 'Cannot use cheer card' };
    }

    if (this.state.cheerCardsUsed >= this.state.maxCheerCards) {
      return { success: false, error: 'Max cheer cards used' };
    }

    const effects = {
      1: {
        type: 'doubleDamage',
        description: 'Next attack deals double damage',
      },
      2: {
        type: 'healAll',
        amount: 80,
        description: 'Heal 80 HP to all active Pokemon',
      },
      3: { type: 'fullHeal', description: 'Fully heal one Pokemon' },
      4: {
        type: 'limitBoss',
        description: 'Boss can only attack once next turn',
      },
      5: {
        type: 'damageBoost',
        amount: 50,
        description: 'All attacks +50 damage this turn',
      },
    };

    const effect = effects[action.cardNumber];
    if (!effect) {
      return { success: false, error: 'Invalid cheer card' };
    }

    // Apply effect
    if (effect.type === 'healAll') {
      this.state.activePlayers.forEach((p) => {
        p.pokemon.active.currentHP = Math.min(
          p.pokemon.active.maxHP,
          p.pokemon.active.currentHP + effect.amount
        );
      });
    }

    this.state.cheerCardsUsed++;
    player.canUseCheer = false;

    this.queueEvent('cheerCardUsed', {
      playerId: player.id,
      username: player.username,
      cardNumber: action.cardNumber,
      effect: effect,
    });

    return { success: true, effect: effect, endTurn: true };
  }

  processTestKO(player, action) {
    const pokemon =
      action.pokemon === 'bench' ? player.pokemon.bench : player.pokemon.active;
    pokemon.currentHP = 0;
    pokemon.status = 'ko';

    player.koCount++;
    this.state.totalKOs++;
    player.canUseCheer = true;

    this.queueEvent('pokemonKO', {
      playerId: player.id,
      username: player.username,
      pokemonName: pokemon.name,
      totalKOs: this.state.totalKOs,
    });

    return { success: true, totalKOs: this.state.totalKOs };
  }

  processEndTurn(player) {
    return { success: true, endTurn: true };
  }

  processSpectatorAction(spectatorId, action) {
    if (action.type === 'spectatorChat') {
      this.queueEvent('spectatorChat', {
        spectatorId: spectatorId,
        message: action.message,
      });
      return { success: true };
    }

    return { success: false, error: 'Invalid spectator action' };
  }

  // ================ TURN MANAGEMENT ================

  advanceTurn() {
    const nextPlayer = this.turnManager.nextTurn();

    if (!nextPlayer) {
      // All players have acted, boss turn
      this.processBossTurn();
    } else {
      this.queueEvent('turnChanged', {
        currentPlayer: nextPlayer,
        turnOrder: this.turnManager.getTurnOrder(),
      });
    }
  }

  processBossTurn() {
    this.state.phase = 'bossTurn';

    const bossActions = this.bossAI.generateActions(
      this.state.boss,
      this.state.activePlayers,
      this.state
    );

    const results = [];

    for (const action of bossActions) {
      const result = this.combatSystem.processBossAttack(
        action,
        this.state.boss,
        this.state.activePlayers
      );

      results.push(result);

      // Check for KOs
      result.targets.forEach((target) => {
        if (target.newHP <= 0) {
          const player = this.state.activePlayers.get(target.playerId);
          if (player) {
            player.pokemon.active.currentHP = 0;
            player.pokemon.active.status = 'ko';
            player.koCount++;
            this.state.totalKOs++;
            player.canUseCheer = true;
          }
        }
      });
    }

    this.queueEvent('bossTurnComplete', {
      attacks: results,
      totalKOs: this.state.totalKOs,
    });

    // Check game state
    this.checkGameState();

    // Return to player phase
    if (this.state.phase === 'bossTurn') {
      this.state.phase = 'playing';
      this.state.round++;
      this.turnManager.startTurn(this.state.activePlayers);
    }
  }

  // ================ GAME STATE ================

  checkGameState() {
    // Check victory
    if (this.state.boss.currentHP <= 0) {
      this.state.phase = 'victory';
      this.queueEvent('gameEnded', {
        victory: true,
        reason: 'Boss defeated!',
      });
      return;
    }

    // Check defeat
    if (this.state.totalKOs >= this.state.maxKOs) {
      this.state.phase = 'defeat';
      this.queueEvent('gameEnded', {
        victory: false,
        reason: 'Too many KOs!',
      });
      return;
    }

    // Check if all players eliminated
    const activeCount = Array.from(this.state.activePlayers.values()).filter(
      (p) => p.pokemon.active.status !== 'ko' || p.pokemon.bench.status !== 'ko'
    ).length;

    if (activeCount === 0) {
      this.state.phase = 'defeat';
      this.queueEvent('gameEnded', {
        victory: false,
        reason: 'All players eliminated!',
      });
    }
  }

  // ================ STATE EXPORT ================

  getGameState() {
    return {
      raidId: this.raidId,
      phase: this.state.phase,
      round: this.state.round,
      boss: {
        ...this.state.boss,
        hpPercent: (this.state.boss.currentHP / this.state.boss.maxHP) * 100,
      },
      players: Array.from(this.state.activePlayers.values()),
      spectators: Array.from(this.state.spectators.values()),
      currentTurn: this.turnManager.getCurrentTurn(),
      turnOrder: this.turnManager.getTurnOrder(),
      totalKOs: this.state.totalKOs,
      maxKOs: this.state.maxKOs,
      cheerCardsUsed: this.state.cheerCardsUsed,
      maxCheerCards: this.state.maxCheerCards,
      lastUpdate: this.state.lastUpdate,
    };
  }

  // ================ EVENT MANAGEMENT ================

  queueEvent(type, data) {
    this.eventQueue.push({
      type,
      data,
      timestamp: Date.now(),
    });

    this.state.lastUpdate = Date.now();
  }

  consumeEvents() {
    const events = [...this.eventQueue];
    this.eventQueue = [];
    return events;
  }

  // ================ DEBUG METHODS ================

  setDebugState(updates) {
    // Allow debug controller to modify state
    Object.assign(this.state, updates);
    this.queueEvent('debugStateUpdate', updates);
  }

  forceTurn(playerId) {
    this.turnManager.setCurrentTurn(playerId);
    this.queueEvent('debugTurnForced', { playerId });
  }
}

// ===================================================================
// Future Scripts Needed:
// 1. client/src/raid/components/RaidHealthBar.js - Health bar visualization
// 2. client/src/raid/components/RaidTurnIndicator.js - Turn order display
// 3. server/raid/persistence/RaidStateManager.js - Save/load raid states
// 4. server/raid/validation/RaidActionValidator.js - Action validation
// 5. shared/raid/RaidConstants.js - Shared game constants
// ===================================================================
