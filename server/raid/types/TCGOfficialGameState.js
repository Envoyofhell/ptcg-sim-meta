// ===================================================================
// File: server/raid/types/TCGOfficialGameState.js
// Path: /server/raid/types/TCGOfficialGameState.js
// Location: Server-side raid game state management
// Changes: Initial implementation of TCG Official raid mechanics
// Dependencies: ../core/RaidEngine.js, ./SpectatorManager.js, ./TurnManager.js
// Dependents: ../core/RaidInstance.js, TCGOfficialRaid.js
// Changelog: 
//   v1.0.0 - Initial implementation with core game state
//   v1.0.1 - Added spectator mode and turn management
// Version: 1.0.1
// ===================================================================

import { SpectatorManager } from './SpectatorManager.js';
import { TurnManager } from './TurnManager.js';
import { BossAI } from './BossAI.js';

export class TCGOfficialGameState {
  constructor(raidConfig, players) {
    this.raidId = raidConfig.raidId;
    this.config = raidConfig;
    
    // Core game state
    this.boss = this.initializeBoss(raidConfig, players);
    this.players = this.initializePlayers(players);
    this.gamePhase = 'setup'; // setup, playing, victory, defeat
    
    // KO tracking
    this.totalKOCount = 0;
    this.maxKOCount = 4;
    
    // Cheer system
    this.cheerCardsUsed = 0;
    this.maxCheerCards = 3;
    this.availableCheerCards = [1, 2, 3, 4, 5]; // Cards 1-5 available
    
    // Managers
    this.spectatorManager = new SpectatorManager(this);
    this.turnManager = new TurnManager(this);
    this.bossAI = new BossAI(this);
    
    // Boss Attack Deck
    this.bossAttackDeck = this.createBossAttackDeck();
    this.bossAttackDiscard = [];
    
    this.lastUpdate = Date.now();
  }

  // ================ INITIALIZATION ================
  
  initializeBoss(config, players) {
    const totalDamage = this.calculateTotalPlayerDamage(players);
    const level = this.determineBossLevel(totalDamage);
    
    return {
      card: config.bossCard || { name: 'Mysterious Boss', hp: { 1: 800, 2: 1200, 3: 1600 } },
      level: level,
      currentHP: config.bossCard?.hp[level] || (level === 1 ? 800 : level === 2 ? 1200 : 1600),
      maxHP: config.bossCard?.hp[level] || (level === 1 ? 800 : level === 2 ? 1200 : 1600),
      maxAttacksPerTurn: level === 1 ? 2 : level === 2 ? 3 : 4,
      attacksThisTurn: 0,
      status: 'active' // active, defeated
    };
  }

  initializePlayers(players) {
    const playerStates = new Map();
    
    players.forEach((player, playerId) => {
      playerStates.set(playerId, {
        id: playerId,
        username: player.username,
        status: 'active', // active, spectator, eliminated
        pokemon: this.initializePlayerPokemon(player),
        koCount: 0, // Individual KO count for this player
        hasUsedGX: false,
        canUseCheer: false,
        lastAction: null
      });
    });
    
    return playerStates;
  }

  initializePlayerPokemon(player) {
    // For TCG Official: Each player brings 2 Pokemon (1 Active, 1 Bench)
    return {
      active: {
        name: player.pokemon?.active?.name || 'Pokemon 1',
        hp: player.pokemon?.active?.hp || 120,
        maxHP: player.pokemon?.active?.maxHP || 120,
        attacks: player.pokemon?.active?.attacks || [
          { name: 'Basic Attack', damage: 60 }
        ],
        status: 'active', // active, ko
        statusConditions: []
      },
      bench: {
        name: player.pokemon?.bench?.name || 'Pokemon 2', 
        hp: player.pokemon?.bench?.hp || 100,
        maxHP: player.pokemon?.bench?.maxHP || 100,
        attacks: player.pokemon?.bench?.attacks || [
          { name: 'Quick Strike', damage: 40 }
        ],
        status: 'benched', // benched, ko
        statusConditions: []
      }
    };
  }

  // ================ GAME MECHANICS ================

  calculateTotalPlayerDamage(players) {
    let total = 0;
    players.forEach(player => {
      const pokemon1Damage = Math.max(...(player.pokemon?.active?.attacks?.map(a => a.damage) || [60]));
      const pokemon2Damage = Math.max(...(player.pokemon?.bench?.attacks?.map(a => a.damage) || [40]));
      total += Math.max(pokemon1Damage, pokemon2Damage);
    });
    return total;
  }

  determineBossLevel(totalDamage) {
    if (totalDamage < 250) return 1;
    if (totalDamage <= 390) return 1;
    if (totalDamage <= 590) return 2;
    return 3;
  }

  createBossAttackDeck() {
    const deck = [];
    const playerCount = Math.min(4, this.players.size);
    
    // Attack 1 cards (always draw another) - 6 cards total
    for (let i = 0; i < 6; i++) {
      deck.push({
        attackNumber: 1,
        targetPlayer: (i % playerCount) + 1,
        drawAnother: true,
        damage: 30
      });
    }
    
    // Attack 2 cards (50% draw another) - 8 cards total
    for (let i = 0; i < 8; i++) {
      deck.push({
        attackNumber: 2,
        targetPlayer: (i % playerCount) + 1,
        drawAnother: Math.random() < 0.5,
        damage: 60
      });
    }
    
    // Attack 3 cards (25% draw another) - 6 cards total
    for (let i = 0; i < 6; i++) {
      deck.push({
        attackNumber: 3,
        targetPlayer: (i % playerCount) + 1,
        drawAnother: Math.random() < 0.25,
        damage: 100
      });
    }
    
    return this.shuffleArray(deck);
  }

  // ================ PLAYER ACTIONS ================

  processPlayerAttack(playerId, attackData) {
    const player = this.players.get(playerId);
    if (!player || player.status !== 'active') {
      return { success: false, error: 'Player not active' };
    }

    if (this.turnManager.getCurrentPlayer() !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    const pokemon = attackData.pokemon === 'active' ? player.pokemon.active : player.pokemon.bench;
    if (pokemon.status === 'ko') {
      return { success: false, error: 'Pokemon is KO\'d' };
    }

    const attack = pokemon.attacks.find(a => a.name === attackData.attackName);
    if (!attack) {
      return { success: false, error: 'Attack not found' };
    }

    // Apply damage to boss
    const damage = attack.damage;
    this.boss.currentHP = Math.max(0, this.boss.currentHP - damage);
    
    if (this.boss.currentHP <= 0) {
      this.boss.status = 'defeated';
      this.gamePhase = 'victory';
    }

    player.lastAction = {
      type: 'attack',
      pokemon: attackData.pokemon,
      attack: attack.name,
      damage: damage,
      timestamp: Date.now()
    };

    this.turnManager.advanceTurn();
    this.lastUpdate = Date.now();

    return {
      success: true,
      damage: damage,
      newBossHP: this.boss.currentHP,
      bossDefeated: this.boss.status === 'defeated',
      nextTurn: this.turnManager.getCurrentTurnInfo()
    };
  }

  processPlayerRetreat(playerId) {
    const player = this.players.get(playerId);
    if (!player || player.status !== 'active') {
      return { success: false, error: 'Player not active' };
    }

    // Swap active and bench pokemon
    const temp = player.pokemon.active;
    player.pokemon.active = player.pokemon.bench;
    player.pokemon.bench = temp;
    
    player.pokemon.active.status = 'active';
    player.pokemon.bench.status = 'benched';

    player.lastAction = {
      type: 'retreat',
      timestamp: Date.now()
    };

    this.lastUpdate = Date.now();

    return {
      success: true,
      newActive: player.pokemon.active.name,
      newBench: player.pokemon.bench.name
    };
  }

  processCheerCard(playerId, cheerCardNumber) {
    const player = this.players.get(playerId);
    if (!player || !player.canUseCheer) {
      return { success: false, error: 'Cannot use cheer card' };
    }

    if (this.cheerCardsUsed >= this.maxCheerCards) {
      return { success: false, error: 'Maximum cheer cards used' };
    }

    if (!this.availableCheerCards.includes(cheerCardNumber)) {
      return { success: false, error: 'Cheer card not available' };
    }

    // Remove card from available
    this.availableCheerCards = this.availableCheerCards.filter(c => c !== cheerCardNumber);
    this.cheerCardsUsed++;
    player.canUseCheer = false;

    const effect = this.applyCheerCardEffect(cheerCardNumber);

    player.lastAction = {
      type: 'cheer',
      cardNumber: cheerCardNumber,
      effect: effect,
      timestamp: Date.now()
    };

    this.lastUpdate = Date.now();

    return {
      success: true,
      cheerCard: cheerCardNumber,
      effect: effect,
      cheerCardsRemaining: this.maxCheerCards - this.cheerCardsUsed
    };
  }

  applyCheerCardEffect(cardNumber) {
    switch (cardNumber) {
      case 1: // Double damage next turn
        return { type: 'doubleDamage', description: 'Next attack deals double damage', target: 'all' };
      case 2: // Heal 80 from all active Pokemon
        this.players.forEach(player => {
          if (player.pokemon.active.status === 'active') {
            player.pokemon.active.hp = Math.min(
              player.pokemon.active.maxHP,
              player.pokemon.active.hp + 80
            );
          }
        });
        return { type: 'heal', amount: 80, description: 'Healed 80 HP from all active Pokemon' };
      case 3: // Full heal one Pokemon
        return { type: 'fullHeal', description: 'Choose one Pokemon to fully heal', requiresTarget: true };
      case 4: // Boss attacks once next turn
        this.boss.maxAttacksPerTurn = Math.max(1, this.boss.maxAttacksPerTurn - 1);
        return { type: 'limitBossAttacks', description: 'Boss can only attack once next turn' };
      case 5: // +50 damage to all attacks this turn
        return { type: 'damageBoost', amount: 50, description: 'All attacks deal +50 damage this turn' };
      default:
        return { type: 'unknown', description: 'Unknown cheer effect' };
    }
  }

  // ================ BOSS MECHANICS ================

  processBossTurn() {
    if (this.gamePhase !== 'playing') return { success: false, error: 'Game not active' };

    this.boss.attacksThisTurn = 0;
    const attackResults = [];

    // Boss AI determines attacks
    const bossActions = this.bossAI.generateBossActions();
    
    for (const action of bossActions) {
      if (this.boss.attacksThisTurn >= this.boss.maxAttacksPerTurn) break;
      
      const result = this.executeBossAttack(action);
      attackResults.push(result);
      this.boss.attacksThisTurn++;
    }

    // Check for player eliminations
    this.checkPlayerEliminations();
    
    // Reset boss for next turn
    this.boss.maxAttacksPerTurn = this.boss.level === 1 ? 2 : this.boss.level === 2 ? 3 : 4;
    
    this.turnManager.advanceTurn();
    this.lastUpdate = Date.now();

    return {
      success: true,
      attacks: attackResults,
      totalKOCount: this.totalKOCount,
      nextTurn: this.turnManager.getCurrentTurnInfo()
    };
  }

  executeBossAttack(attackCard) {
    const activePlayerIds = Array.from(this.players.entries())
      .filter(([id, player]) => player.status === 'active')
      .map(([id]) => id);

    if (activePlayerIds.length === 0) {
      return { success: false, error: 'No active players' };
    }

    const targetPlayerId = activePlayerIds[(attackCard.targetPlayer - 1) % activePlayerIds.length];
    const targetPlayer = this.players.get(targetPlayerId);

    if (!targetPlayer || targetPlayer.pokemon.active.status === 'ko') {
      return { success: false, error: 'Invalid target' };
    }

    const damage = attackCard.damage;
    targetPlayer.pokemon.active.hp -= damage;

    let koOccurred = false;
    if (targetPlayer.pokemon.active.hp <= 0) {
      targetPlayer.pokemon.active.hp = 0;
      targetPlayer.pokemon.active.status = 'ko';
      targetPlayer.koCount++;
      this.totalKOCount++;
      koOccurred = true;

      // Enable cheer for KO'd player
      targetPlayer.canUseCheer = true;
    }

    return {
      success: true,
      attackNumber: attackCard.attackNumber,
      targetPlayer: targetPlayerId,
      damage: damage,
      koOccurred: koOccurred,
      totalKOCount: this.totalKOCount
    };
  }

  // ================ GAME STATE CHECKS ================

  checkPlayerEliminations() {
    this.players.forEach((player, playerId) => {
      if (player.status === 'active' && 
          player.pokemon.active.status === 'ko' && 
          player.pokemon.bench.status === 'ko') {
        
        // Player eliminated - convert to spectator
        player.status = 'spectator';
        this.spectatorManager.addSpectator(playerId, player.username);
        this.turnManager.removeFromTurnOrder(playerId);
      }
    });
  }

  checkWinCondition() {
    if (this.boss.currentHP <= 0) {
      this.gamePhase = 'victory';
      return { hasWon: true, reason: 'Boss defeated!' };
    }
    return { hasWon: false };
  }

  checkLossCondition() {
    if (this.totalKOCount >= this.maxKOCount) {
      this.gamePhase = 'defeat';
      return { hasLost: true, reason: 'Too many Pokemon KO\'d' };
    }

    const activePlayers = Array.from(this.players.values()).filter(p => p.status === 'active');
    if (activePlayers.length === 0) {
      this.gamePhase = 'defeat';
      return { hasLost: true, reason: 'All players eliminated' };
    }

    return { hasLost: false };
  }

  // ================ STATE MANAGEMENT ================

  getGameState() {
    return {
      raidId: this.raidId,
      gamePhase: this.gamePhase,
      boss: this.boss,
      players: Object.fromEntries(this.players),
      spectators: this.spectatorManager.getSpectators(),
      turnInfo: this.turnManager.getCurrentTurnInfo(),
      koTracking: {
        total: this.totalKOCount,
        max: this.maxKOCount,
        remaining: this.maxKOCount - this.totalKOCount
      },
      cheerSystem: {
        used: this.cheerCardsUsed,
        max: this.maxCheerCards,
        available: this.availableCheerCards
      },
      lastUpdate: this.lastUpdate
    };
  }

  // ================ UTILITIES ================

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getActivePlayerCount() {
    return Array.from(this.players.values()).filter(p => p.status === 'active').length;
  }

  getSpectatorCount() {
    return this.spectatorManager.getSpectatorCount();
  }
}