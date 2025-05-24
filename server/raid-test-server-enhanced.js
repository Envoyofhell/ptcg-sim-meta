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

      // Debug
      debugMode: false,

      createdAt: Date.now(),
      createdBy: config.createdBy || 'Unknown',
    };

    this.raids.set(raidId, raid);
    return raid;
  }

  joinRaid(raidId, playerId, playerData) {
    const raid = this.raids.get(raidId);
    if (!raid) return { error: 'Raid not found' };

    if (raid.players.length >= raid.config.maxPlayers) {
      return { error: 'Raid is full' };
    }

    // Create player with game data
    const player = {
      id: playerId,
      username: playerData.username || 'Anonymous',
      status: 'active', // active, ko, spectator

      // Pokemon data
      activePokemon: {
        name: playerData.activePokemon?.name || 'Pikachu',
        currentHP: playerData.activePokemon?.maxHP || 120,
        maxHP: playerData.activePokemon?.maxHP || 120,
        attacks: playerData.activePokemon?.attacks || [
          { name: 'Thunder Shock', damage: 60 },
        ],
        status: 'active', // active, ko
      },

      benchPokemon: {
        name: 'Squirtle',
        currentHP: 100,
        maxHP: 100,
        attacks: [{ name: 'Water Gun', damage: 50 }],
        status: 'benched',
      },

      // Player stats
      koCount: 0,
      canCheer: false,
      hasUsedGX: false,

      joinedAt: Date.now(),
    };

    raid.players.push(player);

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
    if (raid.gamePhase !== 'playing' && raid.gamePhase !== 'bossTurn') {
      raid.turnIndicator = null;
      return;
    }

    const elements = [];

    if (raid.gamePhase === 'playing') {
      // Show player turns
      raid.players.forEach((player, index) => {
        const isCurrent = player.id === raid.currentTurnPlayerId;
        const turnOrderIndex = raid.turnOrder.indexOf(player.id);

        elements.push({
          type: 'player',
          id: player.id,
          username: player.username,
          status: isCurrent ? 'current' : 'waiting',
          color: this.getPlayerColor(index),
          opacity: isCurrent ? 1.0 : 0.5,
          turnsCompleted: 0, // Track this later
        });
      });
    } else if (raid.gamePhase === 'bossTurn') {
      elements.push({
        type: 'boss',
        id: 'boss',
        name: raid.boss.name,
        status: 'current',
        color: '#e74c3c',
        attacksRemaining: 1,
        maxAttacks: 1,
      });
    }

    raid.turnIndicator = {
      type: 'dynamic',
      layout: 'horizontal',
      elements: elements,
      currentPhase: raid.gamePhase,
    };
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

    console.log(`Processing action: ${action.type} from ${player.username}`);

    switch (action.type) {
      case 'playerAttack':
        return this.handleAttack(raid, player, action);

      case 'playerRetreat':
        return this.handleRetreat(raid, player);

      case 'testKO':
        return this.handleTestKO(raid, player, action);

      case 'cheerCard':
        return this.handleCheerCard(raid, player, action);

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

      default:
        return { error: 'Unknown action type' };
    }
  }

  handleAttack(raid, player, action) {
    // Check if it's player's turn
    if (raid.currentTurnPlayerId !== player.id) {
      return { error: 'Not your turn!' };
    }

    if (player.activePokemon.status === 'ko') {
      return { error: 'Your active Pokemon is knocked out!' };
    }

    const damage = action.damage || 60;
    raid.boss.currentHP = Math.max(0, raid.boss.currentHP - damage);

    const result = {
      success: true,
      message: `${player.username}'s ${player.activePokemon.name} dealt ${damage} damage!`,
      damage: damage,
      newBossHP: raid.boss.currentHP,
      bossDefeated: raid.boss.currentHP <= 0,
    };

    // Check victory
    if (raid.boss.currentHP <= 0) {
      raid.gamePhase = 'ended';
      result.victory = true;
      result.message += ' Boss defeated! Victory!';
    } else {
      // Advance turn
      this.advanceTurn(raid);
    }

    return result;
  }

  handleRetreat(raid, player) {
    if (player.benchPokemon.status === 'ko') {
      return { error: 'Bench Pokemon is knocked out!' };
    }

    // Swap active and bench
    const temp = player.activePokemon;
    player.activePokemon = player.benchPokemon;
    player.benchPokemon = temp;

    return {
      success: true,
      message: `${player.username} retreated! ${player.activePokemon.name} is now active.`,
    };
  }

  handleTestKO(raid, player, action) {
    const target =
      action.pokemon === 'bench' ? player.benchPokemon : player.activePokemon;
    target.currentHP = 0;
    target.status = 'ko';

    player.koCount++;
    raid.koCount++;

    // Check if player is eliminated
    if (
      player.activePokemon.status === 'ko' &&
      player.benchPokemon.status === 'ko'
    ) {
      player.status = 'ko';
      player.canCheer = true;

      // Move to spectators
      raid.spectators.push({
        id: player.id,
        username: player.username,
        wasPlayer: true,
        joinedAt: Date.now(),
      });

      // Remove from turn order
      raid.turnOrder = raid.turnOrder.filter((id) => id !== player.id);

      // Update current turn if needed
      if (raid.currentTurnPlayerId === player.id) {
        this.advanceTurn(raid);
      }
    }

    // Check loss condition
    if (raid.koCount >= raid.maxKoCount) {
      raid.gamePhase = 'ended';
      return {
        success: true,
        message: `${target.name} was knocked out! Too many KOs - Defeat!`,
        defeat: true,
      };
    }

    return {
      success: true,
      message: `${target.name} was knocked out!`,
      koCount: raid.koCount,
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
        effect = 'All active Pokemon healed for 80 HP!';
        raid.players.forEach((p) => {
          if (p.activePokemon.status === 'active') {
            p.activePokemon.currentHP = Math.min(
              p.activePokemon.maxHP,
              p.activePokemon.currentHP + 80
            );
          }
        });
        break;
      case 3:
        effect = 'One Pokemon fully healed!';
        player.activePokemon.currentHP = player.activePokemon.maxHP;
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
        player.activePokemon.currentHP = Math.max(
          0,
          Math.min(player.activePokemon.maxHP, value)
        );
        return {
          success: true,
          message: `Debug: ${player.username}'s active Pokemon HP set to ${player.activePokemon.currentHP}`,
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

  advanceTurn(raid) {
    if (raid.gamePhase !== 'playing') return;

    // Find next active player
    let attempts = 0;
    do {
      raid.turnIndex = (raid.turnIndex + 1) % raid.turnOrder.length;
      attempts++;

      // Check if we've gone full circle
      if (attempts > raid.turnOrder.length) {
        // All players have gone, boss turn
        raid.gamePhase = 'bossTurn';
        raid.currentTurnPlayerId = null;
        this.processBossTurn(raid);
        return;
      }

      const nextPlayerId = raid.turnOrder[raid.turnIndex];
      const nextPlayer = raid.players.find((p) => p.id === nextPlayerId);

      if (nextPlayer && nextPlayer.status === 'active') {
        raid.currentTurnPlayerId = nextPlayerId;
        break;
      }
    } while (attempts <= raid.turnOrder.length);

    this.updateTurnIndicator(raid);
  }

  processBossTurn(raid) {
    console.log('Processing boss turn...');

    // Simple boss AI - attack random player
    const activePlayers = raid.players.filter((p) => p.status === 'active');
    if (activePlayers.length === 0) {
      raid.gamePhase = 'ended';
      return;
    }

    const target =
      activePlayers[Math.floor(Math.random() * activePlayers.length)];
    const attack =
      raid.boss.attacks[Math.floor(Math.random() * raid.boss.attacks.length)];

    target.activePokemon.currentHP = Math.max(
      0,
      target.activePokemon.currentHP - attack.damage
    );

    const bossResult = {
      attack: attack.name,
      damage: attack.damage,
      target: target.username,
      targetNewHP: target.activePokemon.currentHP,
    };

    if (target.activePokemon.currentHP <= 0) {
      target.activePokemon.status = 'ko';
      target.koCount++;
      raid.koCount++;
      bossResult.targetKO = true;
    }

    // Store boss action result
    raid.lastBossAction = bossResult;

    // Return to player turns
    setTimeout(() => {
      raid.gamePhase = 'playing';
      raid.turnIndex = -1; // Will advance to 0
      this.advanceTurn(raid);
    }, 2000);
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
    const raid = gameEngine.createRaid(data.raidId, data);
    socket.join(data.raidId);

    // Auto-start if it's a single player test
    if (data.autoStart) {
      const joinResult = gameEngine.joinRaid(data.raidId, socket.id, {
        username: data.createdBy || 'Host',
      });

      if (joinResult.success) {
        gameEngine.startGame(data.raidId);
      }
    }

    socket.emit('raidCreated', {
      success: true,
      raidId: raid.id,
      playerId: socket.id,
      raidState: raid,
    });

    console.log(`🏴‍☠️ Raid created: ${raid.id}`);
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

      io.to(data.raidId).emit('playerJoinedRaid', {
        raidId: data.raidId,
        player: raid.players.find((p) => p.id === socket.id),
        playerCount: raid.players.length,
        updatedRaidState: raid,
      });

      console.log(
        `👋 ${data.playerData?.username || 'Player'} joined raid ${data.raidId}`
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

      io.to(data.raidId).emit('layoutUpdated', {
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
