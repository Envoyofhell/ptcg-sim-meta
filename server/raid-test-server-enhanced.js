// ===================================================================
// File: server/raid-test-server-enhanced.js
// Path: /server/raid-test-server-enhanced.js
// Purpose: Enhanced raid server with actual game mechanics implementation
// Version: 3.0.0
//
// Dependencies:
//   - express, cors, socket.io
//   - ./raid/core/RaidGameEngine.js (to be created)
//
// Changelog:
//   v3.0.0 - Complete rewrite with game mechanics
//   v2.0.0 - Added turn management and game state
//   v1.0.0 - Basic socket relay
// ===================================================================

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../client');

console.log('🚀 Starting Enhanced PTCG Raid Server v3.0.0...');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:4000'],
    credentials: true,
  },
});

app.use(cors());
app.use(express.static(clientDir));

// ===== ROUTES =====
app.get('/', (req, res) => {
  res.sendFile(path.join(clientDir, 'raid-test.html'));
});

// ===== GAME STATE MANAGEMENT =====
class RaidGameEngine {
  constructor() {
    this.raids = new Map();
  }

  createRaid(raidId, config) {
    const raid = {
      id: raidId,
      config: config,
      state: 'lobby',
      players: [],
      spectators: [],
      positions: { players: [], boss: null },
      gamePhase: 'lobby', // lobby, playing, bossTurn, ended
      currentTurnPlayerId: null,
      turnOrder: [],
      turnIndex: 0,

      // Boss data
      boss: {
        name: 'Mysterious Raid Boss',
        currentHP: 1000,
        maxHP: 1000,
        level: 1,
        attacks: [
          { name: 'Slash', damage: 30 },
          { name: 'Mega Punch', damage: 60 },
          { name: 'Hyper Beam', damage: 100 },
        ],
      },

      // Game mechanics
      koCount: 0,
      maxKoCount: 4,
      cheerCardsUsed: [],

      // Turn management
      turnIndicator: null,

      // Debug - enabled by default for testing
      debugMode: true,

      createdAt: Date.now(),
      createdBy: config.createdBy || 'Unknown',
    };

    this.raids.set(raidId, raid);
    return raid;
  }

  joinRaid(raidId, playerId, playerData) {
    const raid = this.raids.get(raidId);
    if (!raid) return { error: 'Raid not found' };

    // Enhanced: Allow joining as spectator
    const joinAsSpectator = playerData.joinAsSpectator || false;

    if (!joinAsSpectator && raid.players.length >= raid.config.maxPlayers) {
      return { error: 'Raid is full' };
    }

    // Enhanced: Create player with comprehensive card system
    const player = {
      id: playerId,
      username: playerData.username || 'Anonymous',
      status: joinAsSpectator ? 'spectator' : 'active',

      // Enhanced: Player profile information
      profile: {
        icon: playerData.profile?.icon || '🎮',
        badge: playerData.profile?.badge || 'Novice',
        level: playerData.profile?.level || 1,
        experience: playerData.profile?.experience || 0,
        wins: playerData.profile?.wins || 0,
        losses: playerData.profile?.losses || 0,
        favoriteType: playerData.profile?.favoriteType || 'Electric',
      },

      // Enhanced: Card-based system with placeholder test cards
      cards: {
        active: {
          id: 'test-card-1',
          name: playerData.cards?.active?.name || 'Pikachu',
          type: 'Electric',
          currentHP: playerData.cards?.active?.maxHP || 120,
          maxHP: playerData.cards?.active?.maxHP || 120,
          attacks: playerData.cards?.active?.attacks || [
            {
              name: 'Thunder Shock',
              damage: 60,
              energyCost: ['Electric'],
              description: 'Basic electric attack',
            },
          ],
          abilities: playerData.cards?.active?.abilities || [],
          weakness: 'Fighting',
          resistance: 'Metal',
          retreatCost: ['Colorless'],
          status: 'active',
          statusEffects: [], // poisoned, burned, paralyzed, etc.
          attachedEnergy: ['Electric'],
          isGX: false,
          rarity: 'Common',
        },

        bench: {
          id: 'test-card-2',
          name: playerData.cards?.bench?.name || 'Squirtle',
          type: 'Water',
          currentHP: playerData.cards?.bench?.maxHP || 100,
          maxHP: playerData.cards?.bench?.maxHP || 100,
          attacks: playerData.cards?.bench?.attacks || [
            {
              name: 'Water Gun',
              damage: 50,
              energyCost: ['Water'],
              description: 'Basic water attack',
            },
          ],
          abilities: playerData.cards?.bench?.abilities || [],
          weakness: 'Grass',
          resistance: 'Fire',
          retreatCost: ['Colorless'],
          status: 'benched',
          statusEffects: [],
          attachedEnergy: ['Water'],
          isGX: false,
          rarity: 'Common',
        },

        // Enhanced: Additional card slots for future deck system
        deck: [], // Future: Full 60-card deck
        hand: [], // Future: Current hand of cards
        discard: [], // Future: Discard pile
        prizes: [], // Future: Prize cards
      },

      // Enhanced: Game state tracking
      gameState: {
        energyPerTurn: 1,
        hasPlayedEnergy: false,
        hasAttacked: false,
        canRetreat: true,
        koCount: 0,
        canCheer: false,
        hasUsedGX: false,
        turnActions: [],
      },

      // Enhanced: Raid-specific data
      raidData: {
        angle: 0, // Will be calculated
        position: { x: 0, y: 0 },
        joinedAt: Date.now(),
        lastAction: null,
        damageDealt: 0,
        damageTaken: 0,
        turnsPlayed: 0,
      },
    };

    // Enhanced: Add to appropriate list
    if (joinAsSpectator) {
      raid.spectators.push({
        id: playerId,
        username: player.username,
        profile: player.profile,
        joinedAt: Date.now(),
        wasPlayer: false,
        reason: 'Joined as spectator',
      });

      return {
        success: true,
        raid,
        joinedAsSpectator: true,
        spectatorData: raid.spectators[raid.spectators.length - 1],
      };
    } else {
      raid.players.push(player);
    }

    // Recalculate positions
    this.updateRaidPositions(raid);

    // Add to turn order if game is active
    if (raid.gamePhase === 'playing' && !raid.turnOrder.includes(playerId)) {
      raid.turnOrder.push(playerId);
    }

    return { success: true, raid };
  }

  updateRaidPositions(raid) {
    const playerCount = raid.players.length;
    const layout = raid.config.layout || 'versus';

    // Calculate player positions
    const positions = { players: [], boss: null };

    if (layout === 'versus') {
      // Players on one side (15-75 degrees)
      const startAngle = 15;
      const endAngle = 75;
      const angleStep =
        playerCount > 1 ? (endAngle - startAngle) / (playerCount - 1) : 0;

      raid.players.forEach((player, index) => {
        const angle = playerCount === 1 ? 45 : startAngle + angleStep * index;
        const radians = (angle * Math.PI) / 180;
        const radius = 35;

        positions.players.push({
          playerId: player.id,
          angle: angle,
          x: 50 + radius * Math.cos(radians),
          y: 50 - radius * Math.sin(radians), // Negative because Y increases downward
        });
      });

      // Boss at top center
      positions.boss = { x: 50, y: 15, angle: 270 };
    } else {
      // Circular layout
      const angleStep = 360 / playerCount;
      const radius = 30;

      raid.players.forEach((player, index) => {
        const angle = index * angleStep;
        const radians = (angle * Math.PI) / 180;

        positions.players.push({
          playerId: player.id,
          angle: angle,
          x: 50 + radius * Math.cos(radians),
          y: 50 - radius * Math.sin(radians),
        });
      });

      // Boss at center
      positions.boss = { x: 50, y: 50, angle: 0 };
    }

    raid.positions = positions;
    this.updateTurnIndicator(raid);
  }

  startGame(raidId) {
    const raid = this.raids.get(raidId);
    if (!raid || raid.players.length < 1) return false;

    raid.gamePhase = 'playing';
    raid.turnOrder = raid.players
      .filter((p) => p.status === 'active')
      .map((p) => p.id);
    raid.turnIndex = 0;
    raid.currentTurnPlayerId = raid.turnOrder[0];

    this.updateTurnIndicator(raid);
    return true;
  }

  updateTurnIndicator(raid) {
    // Always show turn indicator if we have at least one player
    if (raid.players.length === 0) {
      raid.turnIndicator = null;
      return;
    }

    const elements = [];

    // Always show player turns (even for single player)
    raid.players.forEach((player, index) => {
      const isCurrent =
        player.id === raid.currentTurnPlayerId && raid.gamePhase === 'playing';

      elements.push({
        type: 'player',
        id: player.id,
        username: player.username,
        status: isCurrent ? 'current' : 'waiting',
        color: this.getPlayerColor(index),
        opacity: isCurrent ? 1.0 : 0.5,
        turnsCompleted: 0,
      });
    });

    // Always show boss turn element
    const isBossTurn = raid.gamePhase === 'bossTurn';
    elements.push({
      type: 'boss',
      id: 'boss',
      name: raid.boss.name,
      status: isBossTurn ? 'current' : 'waiting',
      color: '#e74c3c',
      opacity: isBossTurn ? 1.0 : 0.5,
      attacksRemaining: 1,
      maxAttacks: 1,
    });

    raid.turnIndicator = {
      type: 'dynamic',
      layout: 'horizontal',
      elements: elements,
      currentPhase: raid.gamePhase,
      showAlways: true, // Always show turn indicator
    };

    console.log(
      `🎯 TURN INDICATOR: Updated with ${elements.length} elements (${raid.gamePhase} phase)`
    );
  }

  getPlayerColor(index) {
    const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12'];
    return colors[index % colors.length];
  }

  processAction(raidId, playerId, action) {
    const raid = this.raids.get(raidId);
    if (!raid) return { error: 'Raid not found' };

    const player = raid.players.find((p) => p.id === playerId);
    if (!player) return { error: 'Player not found' };

    console.log(`🎮 Processing action: ${action.type} from ${player.username}`);
    console.log(`🐞 Debug mode: ${raid.debugMode ? 'ENABLED' : 'DISABLED'}`);
    console.log(`📦 Action data:`, action);

    switch (action.type) {
      case 'playerAttack':
        return this.handleAttack(raid, player, action);

      case 'playerRetreat':
        return this.handleRetreat(raid, player);

      case 'testKO':
        return this.handleTestKO(raid, player, action);

      case 'cheerCard':
        return this.handleCheerCard(raid, player, action);

      case 'bossAttack':
        if (raid.debugMode) {
          return this.handleBossAttack(raid, action);
        }
        return { error: 'Debug mode not enabled' };

      case 'debugSetHP':
        if (raid.debugMode) {
          return this.handleDebugSetHP(raid, action);
        }
        return { error: 'Debug mode not enabled' };

      case 'forceNextTurn':
        if (raid.debugMode) {
          return this.handleForceNextTurn(raid);
        }
        return { error: 'Debug mode not enabled' };

      case 'toggleDebugMode':
        return this.handleToggleDebugMode(raid, playerId);

      case 'debugResurrectPlayer':
        if (raid.debugMode) {
          return this.handleDebugResurrectPlayer(raid, action);
        }
        return { error: 'Debug mode not enabled' };

      case 'debugKillPlayer':
        if (raid.debugMode) {
          return this.handleDebugKillPlayer(raid, action);
        }
        return { error: 'Debug mode not enabled' };

      case 'debugHealPlayer':
        if (raid.debugMode) {
          return this.handleDebugHealPlayer(raid, action);
        }
        return { error: 'Debug mode not enabled' };

      case 'debugSetPlayerStatus':
        if (raid.debugMode) {
          return this.handleDebugSetPlayerStatus(raid, action);
        }
        return { error: 'Debug mode not enabled' };

      case 'debugSkipTurn':
        if (raid.debugMode) {
          return this.handleDebugSkipTurn(raid);
        }
        return { error: 'Debug mode not enabled' };

      case 'debugResetRaid':
        if (raid.debugMode) {
          return this.handleDebugResetRaid(raid);
        }
        return { error: 'Debug mode not enabled' };

      case 'debugForceBossTurn':
        if (raid.debugMode) {
          return this.handleDebugForceBossTurn(raid);
        }
        return { error: 'Debug mode not enabled' };

      case 'debugStartGame':
        if (raid.debugMode) {
          return this.handleDebugStartGame(raid);
        }
        return { error: 'Debug mode not enabled' };

      default:
        return { error: 'Unknown action type' };
    }
  }

  handleAttack(raid, player, action) {
    // Allow attacks in lobby phase for testing
    if (
      raid.gamePhase === 'playing' &&
      raid.currentTurnPlayerId !== player.id
    ) {
      return { error: 'Not your turn!' };
    }

    // First, check if player is already marked as KO/spectator
    if (player.status === 'ko' || player.status === 'spectator') {
      return { error: 'Cannot attack while knocked out or as spectator!' };
    }

    // Enhanced: Check card-based KO status
    if (
      player.cards.active.status === 'ko' &&
      player.cards.bench.status === 'ko'
    ) {
      console.log(
        `👻 ATTACK BLOCKED: ${player.username} - both cards KO'd, moving to spectator`
      );
      return this.movePlayerToSpectator(raid, player);
    }

    // Enhanced: Handle active card KO situation
    if (player.cards.active.status === 'ko') {
      // Check if bench card is available for auto-retreat
      if (player.cards.bench.status !== 'ko') {
        // Auto-retreat to bench card
        console.log(
          `🔄 AUTO-RETREAT: ${player.username} swapping ${player.cards.active.name} → ${player.cards.bench.name}`
        );

        const temp = player.cards.active;
        player.cards.active = player.cards.bench;
        player.cards.bench = temp;

        // Make sure the newly active card is set to active status
        player.cards.active.status = 'active';

        console.log(
          `✅ AUTO-RETREAT COMPLETE: ${player.username} now has ${player.cards.active.name} active (${player.cards.active.currentHP}/${player.cards.active.maxHP} HP)`
        );
      } else {
        // Both cards are KO'd - move to spectator
        console.log(`👻 BOTH KO'D: ${player.username} - moving to spectator`);
        return this.movePlayerToSpectator(raid, player);
      }
    }

    // Final safety check - don't allow attacks if active card is still KO'd
    if (player.cards.active.status === 'ko') {
      return { error: 'Cannot attack with a knocked out card!' };
    }

    // Enhanced: Calculate damage with card-based system
    const selectedAttack = player.cards.active.attacks[action.attackIndex || 0];
    const damage = action.damage || selectedAttack?.damage || 60;
    const attackName = selectedAttack?.name || 'Basic Attack';

    const oldBossHP = raid.boss.currentHP;
    raid.boss.currentHP = Math.max(0, raid.boss.currentHP - damage);
    const newBossHP = raid.boss.currentHP;

    // Enhanced: Update player statistics
    player.raidData.damageDealt += oldBossHP - newBossHP;
    player.raidData.turnsPlayed++;
    player.raidData.lastAction = {
      type: 'attack',
      attackName: attackName,
      damage: damage,
      timestamp: Date.now(),
    };

    // Mark that player has attacked this turn
    player.gameState.hasAttacked = true;

    // Enhanced logging for debugging
    console.log(`💥 ENHANCED ATTACK DEBUG:`);
    console.log(`  Player: ${player.username} (ID: ${player.id})`);
    console.log(`  Player Status: ${player.status}`);
    console.log(
      `  Active Card: ${player.cards.active.name} (${player.cards.active.currentHP}/${player.cards.active.maxHP}) - ${player.cards.active.status}`
    );
    console.log(
      `  Bench Card: ${player.cards.bench.name} (${player.cards.bench.currentHP}/${player.cards.bench.maxHP}) - ${player.cards.bench.status}`
    );
    console.log(`  Attack: ${attackName}`);
    console.log(`  Damage: ${damage}`);
    console.log(`  Boss HP: ${oldBossHP} → ${newBossHP}`);
    console.log(`  Total Damage Dealt: ${player.raidData.damageDealt}`);

    const result = {
      success: true,
      message: `${player.username}'s ${player.cards.active.name} used ${attackName} for ${damage} damage!`,
      attackName: attackName,
      damage: damage,
      target: 'boss',
      oldBossHP: oldBossHP,
      newBossHP: newBossHP,
      actualDamage: oldBossHP - newBossHP,
      bossDefeated: raid.boss.currentHP <= 0,
      playerStats: {
        totalDamage: player.raidData.damageDealt,
        turnsPlayed: player.raidData.turnsPlayed,
      },
    };

    // Check victory
    if (raid.boss.currentHP <= 0) {
      raid.gamePhase = 'ended';
      result.victory = true;
      result.message += ' Boss defeated! Victory!';
      console.log(`🏆 VICTORY! Boss defeated by ${player.username}`);
    } else if (raid.gamePhase === 'playing') {
      // Only advance turn in playing phase
      this.advanceTurn(raid);
    }

    return result;
  }

  movePlayerToSpectator(raid, player) {
    console.log(
      `👻 SPECTATOR: Moving ${player.username} to spectator mode (both cards KO'd)`
    );

    // Mark player as KO'd/spectator
    player.status = 'ko';
    player.canCheer = true;

    // Ensure both cards are marked as KO'd
    player.cards.active.status = 'ko';
    player.cards.bench.status = 'ko';
    player.cards.active.currentHP = 0;
    player.cards.bench.currentHP = 0;

    // Add to spectators list if not already there
    if (!raid.spectators.some((s) => s.id === player.id)) {
      raid.spectators.push({
        id: player.id,
        username: player.username,
        wasPlayer: true,
        joinedAt: Date.now(),
        reason: 'Both cards knocked out',
      });
    }

    // Remove from turn order
    const oldTurnOrder = [...raid.turnOrder];
    raid.turnOrder = raid.turnOrder.filter((id) => id !== player.id);

    console.log(
      `🔄 TURN ORDER: ${oldTurnOrder.join(', ')} → ${raid.turnOrder.join(', ')}`
    );

    // Update current turn if this was the active player
    if (raid.currentTurnPlayerId === player.id) {
      console.log(
        `🎯 CURRENT PLAYER KO'D: Advancing turn from ${player.username}`
      );
      this.advanceTurn(raid);
    }

    // Update positions to reflect new player count
    this.updateRaidPositions(raid);

    const result = {
      success: true,
      message: `${player.username} has been moved to spectator mode - both cards are knocked out!`,
      playerBecameSpectator: true,
      spectatorCount: raid.spectators.length,
      remainingPlayers: raid.players.filter((p) => p.status === 'active')
        .length,
    };

    console.log(
      `📊 SPECTATOR RESULT: ${result.remainingPlayers} active players, ${result.spectatorCount} spectators`
    );

    return result;
  }

  handleRetreat(raid, player) {
    if (player.cards.bench.status === 'ko') {
      return { error: 'Bench card is knocked out!' };
    }

    // Swap active and bench
    const temp = player.cards.active;
    player.cards.active = player.cards.bench;
    player.cards.bench = temp;

    return {
      success: true,
      message: `${player.username} retreated! ${player.cards.active.name} is now active.`,
    };
  }

  handleTestKO(raid, player, action) {
    const target =
      action.pokemon === 'bench' ? player.cards.bench : player.cards.active;

    if (target.status === 'ko') {
      return { error: `${action.pokemon} card is already knocked out` };
    }

    // KO the target card
    const cardName = target.name;
    target.currentHP = 0;
    target.status = 'ko';
    player.koCount++;
    raid.koCount++;

    console.log(
      `🔥 TEST KO: ${player.username}'s ${cardName} was knocked out!`
    );
    console.log(
      `🔍 KO Status Check: Active=${player.cards.active.status}, Bench=${player.cards.bench.status}`
    );

    // CRITICAL: Check if player has no viable cards left
    const hasViableCards =
      player.cards.active.status !== 'ko' || player.cards.bench.status !== 'ko';

    if (!hasViableCards) {
      console.log(
        `👻 NO VIABLE CARDS: ${player.username} - both cards are KO'd, forcing spectator move`
      );

      // Force spectator move and update raid state
      const spectatorResult = this.movePlayerToSpectator(raid, player);

      return {
        success: true,
        message: `${cardName} was knocked out! ${player.username} moved to spectator - no viable cards remaining!`,
        playerBecameSpectator: true,
        koCount: raid.koCount,
        spectatorResult: spectatorResult,
      };
    }

    // If the active card was KO'd but bench is available, auto-retreat
    if (action.pokemon === 'active' && player.cards.bench.status !== 'ko') {
      console.log(
        `🔄 AUTO-RETREAT AVAILABLE: ${player.username} can retreat to ${player.cards.bench.name}`
      );
    }

    // Check global loss condition
    if (raid.koCount >= raid.maxKoCount) {
      raid.gamePhase = 'ended';
      return {
        success: true,
        message: `${cardName} was knocked out! Too many KOs - Defeat!`,
        defeat: true,
      };
    }

    return {
      success: true,
      message: `${cardName} was knocked out!`,
      koCount: raid.koCount,
      playerStatus: player.status,
      activeCardStatus: player.cards.active.status,
      benchCardStatus: player.cards.bench.status,
      hasViableCards: hasViableCards,
    };
  }

  handleCheerCard(raid, player, action) {
    if (!player.canCheer) {
      return { error: 'Cannot use cheer card now!' };
    }

    if (raid.cheerCardsUsed.includes(action.cardNumber)) {
      return { error: 'This cheer card was already used!' };
    }

    if (raid.cheerCardsUsed.length >= 3) {
      return { error: 'Maximum cheer cards already used!' };
    }

    raid.cheerCardsUsed.push(action.cardNumber);
    player.canCheer = false;

    let effect = '';
    switch (action.cardNumber) {
      case 1:
        effect = 'Next attack deals double damage!';
        break;
      case 2:
        effect = 'All active cards healed for 80 HP!';
        raid.players.forEach((p) => {
          if (p.cards.active.status === 'active') {
            p.cards.active.currentHP = Math.min(
              p.cards.active.maxHP,
              p.cards.active.currentHP + 80
            );
          }
        });
        break;
      case 3:
        effect = 'One card fully healed!';
        player.cards.active.currentHP = player.cards.active.maxHP;
        break;
      case 4:
        effect = 'Boss can only attack once next turn!';
        break;
      case 5:
        effect = 'All attacks deal +50 damage this turn!';
        break;
    }

    return {
      success: true,
      message: `${player.username} used Cheer Card #${action.cardNumber}: ${effect}`,
      cheerCardsRemaining: 3 - raid.cheerCardsUsed.length,
    };
  }

  handleBossAttack(raid, action) {
    const { target, attackName, damage } = action;

    const targetPlayer = raid.players.find((p) => p.id === target);
    if (!targetPlayer) {
      return { error: 'Target player not found' };
    }

    if (targetPlayer.cards.active.status === 'ko') {
      return { error: 'Target card is already knocked out' };
    }

    const oldHP = targetPlayer.cards.active.currentHP;
    targetPlayer.cards.active.currentHP = Math.max(0, oldHP - damage);
    const newHP = targetPlayer.cards.active.currentHP;

    console.log(`👹 BOSS ATTACK DEBUG:`);
    console.log(`  Attack: ${attackName}`);
    console.log(`  Target: ${targetPlayer.username}`);
    console.log(`  Damage: ${damage}`);
    console.log(`  Target HP: ${oldHP} → ${newHP}`);

    const result = {
      success: true,
      message: `Boss used ${attackName} on ${targetPlayer.username} for ${damage} damage!`,
      attackName: attackName,
      damage: damage,
      target: targetPlayer.username,
      targetOldHP: oldHP,
      targetNewHP: newHP,
    };

    // Check if card was knocked out
    if (newHP <= 0) {
      targetPlayer.cards.active.status = 'ko';
      targetPlayer.koCount++;
      raid.koCount++;
      result.targetKO = true;
      result.message += ` ${targetPlayer.cards.active.name} was knocked out!`;

      // Check if player should become spectator
      if (targetPlayer.cards.bench.status === 'ko') {
        this.movePlayerToSpectator(raid, targetPlayer);
        result.playerBecameSpectator = true;
      }
    }

    return result;
  }

  handleDebugSetHP(raid, action) {
    const { target, value } = action;

    if (target === 'boss') {
      raid.boss.currentHP = Math.max(0, Math.min(raid.boss.maxHP, value));
      return {
        success: true,
        message: `Debug: Boss HP set to ${raid.boss.currentHP}`,
      };
    } else if (target.startsWith('player-')) {
      const playerId = target.substring(7);
      const player = raid.players.find((p) => p.id === playerId);
      if (player) {
        player.cards.active.currentHP = Math.max(
          0,
          Math.min(player.cards.active.maxHP, value)
        );
        return {
          success: true,
          message: `Debug: ${player.username}'s active card HP set to ${player.cards.active.currentHP}`,
        };
      }
    }

    return { error: 'Invalid debug target' };
  }

  handleForceNextTurn(raid) {
    this.advanceTurn(raid);
    return {
      success: true,
      message: `Debug: Advanced to next turn`,
    };
  }

  handleToggleDebugMode(raid, playerId) {
    // Only allow raid creator to toggle debug mode
    if (raid.createdBy !== playerId) {
      return { error: 'Only raid creator can toggle debug mode' };
    }

    raid.debugMode = !raid.debugMode;

    console.log(
      `🐞 DEBUG MODE: ${raid.debugMode ? 'ENABLED' : 'DISABLED'} by ${playerId}`
    );

    return {
      success: true,
      message: `Debug mode ${raid.debugMode ? 'enabled' : 'disabled'}`,
      debugMode: raid.debugMode,
    };
  }

  handleDebugResurrectPlayer(raid, action) {
    const { playerId } = action;

    const targetPlayer = raid.players.find((p) => p.id === playerId);
    if (!targetPlayer) {
      return { error: 'Target player not found' };
    }

    // Resurrect both active and bench cards
    if (targetPlayer.cards.active.status === 'ko') {
      targetPlayer.cards.active.status = 'active';
      targetPlayer.cards.active.currentHP = targetPlayer.cards.active.maxHP;
    }

    if (targetPlayer.cards.bench.status === 'ko') {
      targetPlayer.cards.bench.status = 'benched';
      targetPlayer.cards.bench.currentHP = targetPlayer.cards.bench.maxHP;
    }

    // Update player status
    targetPlayer.status = 'active';

    // Re-add to turn order if not present
    if (!raid.turnOrder.includes(playerId)) {
      raid.turnOrder.push(playerId);
    }

    // Remove from spectators if present
    raid.spectators = raid.spectators.filter((s) => s.id !== playerId);

    // Update positions
    this.updateRaidPositions(raid);

    return {
      success: true,
      message: `Debug: ${targetPlayer.username} has been resurrected!`,
    };
  }

  handleDebugKillPlayer(raid, action) {
    const { playerId, pokemon } = action;

    const targetPlayer = raid.players.find((p) => p.id === playerId);
    if (!targetPlayer) {
      return { error: 'Target player not found' };
    }

    const targetCard =
      pokemon === 'bench'
        ? targetPlayer.cards.bench
        : targetPlayer.cards.active;

    if (targetCard.status === 'ko') {
      return { error: `${pokemon} card is already knocked out` };
    }

    // KO the target card
    const cardName = targetCard.name;
    targetCard.status = 'ko';
    targetCard.currentHP = 0;
    targetPlayer.koCount++;
    raid.koCount++;

    console.log(
      `🐞 DEBUG KO: ${targetPlayer.username}'s ${pokemon} card (${cardName}) killed`
    );
    console.log(
      `🐞 Player Status Check: Active=${targetPlayer.cards.active.status}, Bench=${targetPlayer.cards.bench.status}`
    );

    // Check if player should become spectator (both cards KO'd)
    if (
      targetPlayer.cards.active.status === 'ko' &&
      targetPlayer.cards.bench.status === 'ko'
    ) {
      console.log(
        `🐞 DEBUG SPECTATOR: Moving ${targetPlayer.username} to spectator (both cards KO'd)`
      );

      const spectatorResult = this.movePlayerToSpectator(raid, targetPlayer);

      return {
        success: true,
        message: `Debug: ${targetPlayer.username}'s ${pokemon} card was killed! Player moved to spectator.`,
        playerBecameSpectator: true,
        spectatorResult: spectatorResult,
      };
    }

    return {
      success: true,
      message: `Debug: ${targetPlayer.username}'s ${pokemon} card was killed!`,
      koCount: raid.koCount,
      playerStatus: targetPlayer.status,
      activeCardStatus: targetPlayer.cards.active.status,
      benchCardStatus: targetPlayer.cards.bench.status,
    };
  }

  handleDebugHealPlayer(raid, action) {
    const { playerId, pokemon, amount } = action;

    const targetPlayer = raid.players.find((p) => p.id === playerId);
    if (!targetPlayer) {
      return { error: 'Target player not found' };
    }

    const targetCard =
      pokemon === 'bench'
        ? targetPlayer.cards.bench
        : targetPlayer.cards.active;

    if (targetCard.status === 'ko') {
      return { error: `${pokemon} card is already knocked out` };
    }

    const oldHP = targetCard.currentHP;
    targetCard.currentHP = Math.min(targetCard.maxHP, oldHP + amount);
    const newHP = targetCard.currentHP;

    const result = {
      success: true,
      message: `Debug: ${targetPlayer.username}'s ${pokemon} card healed for ${amount} HP (${oldHP} → ${newHP})`,
    };

    return result;
  }

  handleDebugSetPlayerStatus(raid, action) {
    const { playerId, status } = action;

    const targetPlayer = raid.players.find((p) => p.id === playerId);
    if (!targetPlayer) {
      return { error: 'Target player not found' };
    }

    targetPlayer.status = status;

    const result = {
      success: true,
      message: `Debug: ${targetPlayer.username}'s status set to ${status}`,
    };

    return result;
  }

  handleDebugSkipTurn(raid) {
    this.advanceTurn(raid);
    return {
      success: true,
      message: `Debug: Skipped to next turn`,
    };
  }

  handleDebugResetRaid(raid) {
    raid.gamePhase = 'lobby';
    raid.players.forEach((p) => {
      p.status = 'active';
      p.cards.active.currentHP = p.cards.active.maxHP;
      p.cards.bench.currentHP = p.cards.bench.maxHP;
      p.cards.active.status = 'active';
      p.cards.bench.status = 'benched';
    });
    this.updateRaidPositions(raid);
    return {
      success: true,
      message: `Debug: Raid reset to lobby phase`,
    };
  }

  handleDebugForceBossTurn(raid) {
    raid.gamePhase = 'bossTurn';
    raid.currentTurnPlayerId = null;
    this.updateTurnIndicator(raid);

    // Process boss turn immediately
    setTimeout(() => {
      this.processBossTurn(raid);
    }, 1000);

    return {
      success: true,
      message: `Debug: Forced boss turn`,
    };
  }

  handleDebugStartGame(raid) {
    this.startGame(raid.id);
    return {
      success: true,
      message: `Debug: Game started`,
    };
  }

  advanceTurn(raid) {
    if (raid.gamePhase !== 'playing') return;

    // Get active players
    const activePlayers = raid.players.filter((p) => p.status === 'active');
    if (activePlayers.length === 0) {
      raid.gamePhase = 'ended';
      console.log('🏁 GAME ENDED: No active players remaining');
      return;
    }

    // Update turn order to only include active players
    raid.turnOrder = activePlayers.map((p) => p.id);

    console.log(
      `🎯 TURN ADVANCE: Current player = ${raid.currentTurnPlayerId}, Turn order = [${raid.turnOrder
        .map((id) => {
          const player = activePlayers.find((p) => p.id === id);
          return player ? player.username : id;
        })
        .join(', ')}]`
    );

    // If this is the first turn, set it up
    if (raid.currentTurnPlayerId === null) {
      raid.turnIndex = 0;
      raid.currentTurnPlayerId = raid.turnOrder[0];
      console.log(`🎯 STARTING TURNS: ${activePlayers[0].username} goes first`);
      this.updateTurnIndicator(raid);
      return;
    }

    // Find current player index
    const currentPlayerIndex = raid.turnOrder.indexOf(raid.currentTurnPlayerId);

    if (currentPlayerIndex === -1) {
      // Current player no longer active, restart from beginning
      raid.turnIndex = 0;
      raid.currentTurnPlayerId = raid.turnOrder[0];
      console.log(
        `🎯 TURN RESET: Current player not found, restarting with ${activePlayers[0].username}`
      );
      this.updateTurnIndicator(raid);
      return;
    }

    // Check if we've reached the end of the turn order
    if (currentPlayerIndex >= raid.turnOrder.length - 1) {
      // All players have had their turn, now it's boss turn
      console.log(
        `🔚 END OF PLAYER TURNS: ${currentPlayerIndex + 1}/${raid.turnOrder.length} players completed`
      );
      console.log('👹 TRIGGERING BOSS TURN: All players completed their turns');

      raid.gamePhase = 'bossTurn';
      raid.currentTurnPlayerId = null;
      raid.turnIndex = -1; // Reset for next round
      this.updateTurnIndicator(raid);

      // Process boss turn immediately
      setTimeout(() => {
        console.log('⏰ BOSS TURN TIMEOUT: Executing boss turn');
        this.processBossTurn(raid);
      }, 1500); // Slight delay for UI updates
      return;
    }

    // Move to next player
    raid.turnIndex = currentPlayerIndex + 1;
    raid.currentTurnPlayerId = raid.turnOrder[raid.turnIndex];

    const nextPlayer = activePlayers.find(
      (p) => p.id === raid.currentTurnPlayerId
    );
    console.log(
      `🎯 TURN ADVANCED: Now ${nextPlayer?.username || 'Unknown'}'s turn (${raid.turnIndex + 1}/${raid.turnOrder.length})`
    );

    this.updateTurnIndicator(raid);
  }

  processBossTurn(raid) {
    console.log('👹 PROCESSING BOSS TURN...');

    // Get active players (not spectators)
    const activePlayers = raid.players.filter(
      (p) => p.status === 'active' && p.cards.active.status !== 'ko'
    );

    if (activePlayers.length === 0) {
      raid.gamePhase = 'ended';
      console.log('🏁 GAME ENDED: No active players for boss to attack');
      return;
    }

    console.log(
      `🎯 BOSS TARGET OPTIONS: ${activePlayers.length} active players`
    );
    activePlayers.forEach((p) => {
      console.log(
        `  - ${p.username}: ${p.cards.active.name} (${p.cards.active.currentHP}/${p.cards.active.maxHP} HP)`
      );
    });

    // Select random target and attack
    const targetPlayer =
      activePlayers[Math.floor(Math.random() * activePlayers.length)];
    const availableAttacks = raid.boss.attacks;
    const selectedAttack =
      availableAttacks[Math.floor(Math.random() * availableAttacks.length)];

    const oldHP = targetPlayer.cards.active.currentHP;
    const damage = selectedAttack.damage;
    const newHP = Math.max(0, oldHP - damage);

    // Apply damage
    targetPlayer.cards.active.currentHP = newHP;

    console.log(`👹 BOSS ATTACK EXECUTED:`);
    console.log(`  Attack: ${selectedAttack.name} (${damage} damage)`);
    console.log(
      `  Target: ${targetPlayer.username}'s ${targetPlayer.cards.active.name}`
    );
    console.log(`  HP Change: ${oldHP} → ${newHP}`);

    const bossResult = {
      attack: selectedAttack.name,
      damage: damage,
      target: targetPlayer.username,
      targetId: targetPlayer.id,
      targetOldHP: oldHP,
      targetNewHP: newHP,
      bossAttackExecuted: true,
    };

    // Check if card was knocked out
    if (newHP <= 0) {
      targetPlayer.cards.active.status = 'ko';
      targetPlayer.koCount++;
      raid.koCount++;
      bossResult.targetKO = true;

      console.log(
        `💀 BOSS KO: ${targetPlayer.username}'s ${targetPlayer.cards.active.name} was knocked out by boss!`
      );

      // Check if player should become spectator (both cards KO'd)
      if (targetPlayer.cards.bench.status === 'ko') {
        console.log(
          `👻 BOSS KO SPECTATOR: ${targetPlayer.username} - both cards KO'd`
        );
        this.movePlayerToSpectator(raid, targetPlayer);
        bossResult.playerBecameSpectator = true;
      }
    }

    // Store boss action result for client
    raid.lastBossAction = bossResult;

    // Return to player turns
    raid.gamePhase = 'playing';
    raid.currentTurnPlayerId = null; // This will trigger first turn setup in advanceTurn
    raid.turnIndex = -1; // Will be set to 0 in advanceTurn

    // Update positions in case players were moved to spectator
    this.updateRaidPositions(raid);

    console.log(`✅ BOSS TURN COMPLETE: Returning to player turns`);
    console.log(
      `📊 Remaining active players: ${raid.players.filter((p) => p.status === 'active').length}`
    );
  }

  removePlayer(raidId, playerId) {
    const raid = this.raids.get(raidId);
    if (!raid) return false;

    raid.players = raid.players.filter((p) => p.id !== playerId);
    raid.turnOrder = raid.turnOrder.filter((id) => id !== playerId);

    if (raid.currentTurnPlayerId === playerId) {
      this.advanceTurn(raid);
    }

    if (raid.players.length === 0) {
      this.raids.delete(raidId);
      return true;
    }

    this.updateRaidPositions(raid);
    return true;
  }

  toggleDebugMode(raidId) {
    const raid = this.raids.get(raidId);
    if (raid) {
      raid.debugMode = !raid.debugMode;
      return raid.debugMode;
    }
    return false;
  }
}

// Create game engine instance
const gameEngine = new RaidGameEngine();

// ===== SOCKET HANDLERS =====
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('createRaid', (data) => {
    const raid = gameEngine.createRaid(data.raidId, {
      raidType: data.raidType || 'tcg-official',
      maxPlayers: data.maxPlayers || 4,
      minPlayers: data.minPlayers || 1,
      layout: data.layout || 'versus',
      createdBy: socket.id,
      raidId: data.raidId,
    });

    if (!raid) {
      socket.emit('raidCreationFailed', {
        message: 'Failed to create raid',
        code: 'CREATION_FAILED',
      });
      return;
    }

    socket.join(raid.id);

    // Automatically join the creator as a player
    const creatorPlayerData = {
      username: 'Host Player',
      activePokemon: {
        name: 'Pikachu',
        maxHP: 120,
        attacks: [{ name: 'Thunder Shock', damage: 60 }],
      },
    };

    const joinResult = gameEngine.joinRaid(
      raid.id,
      socket.id,
      creatorPlayerData
    );

    if (joinResult.success) {
      console.log(`🏴‍☠️ Raid created: ${raid.id} (Creator auto-joined)`);

      socket.emit('raidCreated', {
        success: true,
        raidId: raid.id,
        playerId: socket.id,
        raidState: joinResult.raid,
      });
    } else {
      socket.emit('raidCreated', {
        success: true,
        raidId: raid.id,
        playerId: socket.id,
        raidState: raid,
      });
      console.log(`🏴‍☠️ Raid created: ${raid.id}`);
    }
  });

  socket.on('joinRaid', (data) => {
    const result = gameEngine.joinRaid(
      data.raidId,
      socket.id,
      data.playerData || {}
    );

    if (result.success) {
      socket.join(data.raidId);
      const raid = result.raid;

      // Enhanced: Handle spectator joins
      if (result.joinedAsSpectator) {
        socket.emit('raidJoined', {
          success: true,
          playerId: socket.id,
          raidState: raid,
          joinedAsSpectator: true,
          spectatorData: result.spectatorData,
        });

        // Notify other players about new spectator
        io.to(data.raidId).emit('spectatorJoined', {
          raidId: data.raidId,
          spectator: result.spectatorData,
          spectatorCount: raid.spectators.length,
          updatedRaidState: raid,
        });

        console.log(
          `👻 ${data.playerData?.username || 'Spectator'} joined as spectator in raid ${data.raidId}`
        );
        return;
      }

      // Regular player join
      // Auto-start if we have enough players
      if (
        raid.gamePhase === 'lobby' &&
        raid.players.length >= raid.config.minPlayers
      ) {
        gameEngine.startGame(data.raidId);
      }

      socket.emit('raidJoined', {
        success: true,
        playerId: socket.id,
        raidState: raid,
      });

      // Enhanced: Find the actual joined player (could be last in array)
      const joinedPlayer =
        raid.players.find((p) => p.id === socket.id) ||
        raid.players[raid.players.length - 1];

      io.to(data.raidId).emit('playerJoinedRaid', {
        raidId: data.raidId,
        player: joinedPlayer,
        playerCount: raid.players.length,
        updatedRaidState: raid,
      });

      console.log(
        `👋 ${data.playerData?.username || 'Player'} joined raid ${data.raidId} (${raid.players.length}/${raid.config.maxPlayers} players)`
      );
    } else {
      socket.emit('raidJoinFailed', {
        message: result.error,
        code: 'JOIN_FAILED',
      });
    }
  });

  socket.on('leaveRaid', (data) => {
    const removed = gameEngine.removePlayer(data.raidId, socket.id);
    if (removed) {
      socket.leave(data.raidId);
      const raid = gameEngine.raids.get(data.raidId);

      socket.emit('playerLeftRaid', {
        raidId: data.raidId,
        playerId: socket.id,
        playerUsername: 'You',
      });

      if (raid) {
        socket.to(data.raidId).emit('playerLeftRaid', {
          raidId: data.raidId,
          playerId: socket.id,
          playerUsername: 'A player',
          playerCount: raid.players.length,
          updatedRaidState: raid,
        });
      }
    }
  });

  socket.on('raidAction', (data) => {
    const result = gameEngine.processAction(
      data.raidId,
      socket.id,
      data.action
    );
    const raid = gameEngine.raids.get(data.raidId);

    if (result.success) {
      io.to(data.raidId).emit('raidActionResult', {
        raidId: data.raidId,
        playerId: socket.id,
        actionType: data.action.type,
        message: result.message,
        success: true,
        updatedRaidState: raid,
      });

      // Send game state update
      io.to(data.raidId).emit('gameStateUpdate', {
        raidId: data.raidId,
        raidState: raid,
      });

      // Handle game end
      if (result.victory || result.defeat) {
        io.to(data.raidId).emit('raidEnded', {
          raidId: data.raidId,
          victory: result.victory || false,
          reason: result.message,
        });
      }

      // Handle boss turn completion
      if (raid && raid.lastBossAction) {
        io.to(data.raidId).emit('bossActionCompleted', {
          raidId: data.raidId,
          bossAction: raid.lastBossAction,
        });
        raid.lastBossAction = null;
      }
    } else {
      socket.emit('raidActionFailed', {
        raidId: data.raidId,
        actionType: data.action.type,
        error: result.error || result.message,
      });
    }
  });

  socket.on('switchLayout', (data) => {
    const raid = gameEngine.raids.get(data.raidId);
    if (raid && raid.gamePhase === 'lobby') {
      raid.config.layout = data.layout;
      gameEngine.updateRaidPositions(raid);

      io.to(data.raidId).emit('layoutSwitched', {
        raidId: data.raidId,
        layout: data.layout,
        updatedRaidState: raid,
      });
    }
  });

  socket.on('toggleDebug', (data) => {
    const debugEnabled = gameEngine.toggleDebugMode(data.raidId);
    socket.emit('debugToggled', {
      raidId: data.raidId,
      enabled: debugEnabled,
    });
  });

  socket.on('chatMessage', (data) => {
    const raid = gameEngine.raids.get(data.raidId);
    if (!raid) return;

    const player = raid.players.find((p) => p.id === socket.id);
    if (!player) return;

    // Broadcast chat message to all players in the raid
    io.to(data.raidId).emit('chatMessage', {
      raidId: data.raidId,
      playerId: socket.id,
      username: data.username,
      message: data.message,
      timestamp: Date.now(),
      type: 'player',
    });

    console.log(`💬 CHAT [${data.raidId}] ${data.username}: ${data.message}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);

    // Find and remove from all raids
    for (const [raidId, raid] of gameEngine.raids) {
      if (raid.players.some((p) => p.id === socket.id)) {
        gameEngine.removePlayer(raidId, socket.id);

        if (raid.players.length > 0) {
          io.to(raidId).emit('playerLeftRaid', {
            raidId: raidId,
            playerId: socket.id,
            playerUsername: 'A player',
            playerCount: raid.players.length,
            updatedRaidState: raid,
          });
        }
      }
    }
  });
});

// ===== START SERVER =====
const port = 4000;
server.listen(port, () => {
  console.log('');
  console.log('🚀 Enhanced PTCG Raid Server Ready!');
  console.log(`🌐 Server: http://localhost:${port}`);
  console.log('');
  console.log('✅ Features:');
  console.log('  • Full game state management');
  console.log('  • Turn-based combat system');
  console.log('  • Boss AI implementation');
  console.log('  • Health and damage tracking');
  console.log('  • KO and spectator mechanics');
  console.log('  • Debug mode with controls');
  console.log('  • Proper position calculations');
  console.log('');
});

// ===================================================================
// Future Scripts Needed:
// 1. server/raid/core/RaidGameEngine.js - Extracted game engine class
// 2. server/raid/core/RaidBossAI.js - Advanced boss AI behaviors
// 3. server/raid/core/RaidCombatSystem.js - Combat calculations
// 4. server/raid/core/RaidTurnManager.js - Advanced turn management
// 5. server/raid/core/RaidDebugController.js - Debug interface
// ===================================================================
