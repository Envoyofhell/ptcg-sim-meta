// ===================================================================
// File: server/raid/core/RaidBossAI.js
// Path: /server/raid/core/RaidBossAI.js
// Purpose: Advanced AI system for raid boss behaviors and attack patterns
// Version: 1.0.0
//
// Dependencies:
//   - ./RaidCombatSystem.js (for damage calculations)
//
// Used By:
//   - ./RaidGameEngine.js
//   - ./RaidTurnManager.js
//
// Changelog:
//   v1.0.0 - Initial implementation with dynamic attack selection
// ===================================================================

export class RaidBossAI {
  constructor(bossLevel = 1) {
    this.level = bossLevel;
    this.difficulty = this.calculateDifficulty(bossLevel);

    // AI state tracking
    this.state = {
      aggroTarget: null,
      lastAttackUsed: null,
      consecutiveAttacks: 0,
      healthThreshold: 1.0,
      enrageMode: false,
      attackPattern: 'adaptive', // adaptive, aggressive, defensive, random
    };

    // Attack preferences based on situation
    this.attackPreferences = {
      low_health: ['heal', 'defensive', 'aoe'],
      high_aggro: ['single_target', 'high_damage'],
      multiple_targets: ['aoe', 'status_effect'],
      single_target: ['single_target', 'status_effect'],
    };

    console.log(
      `[RaidBossAI] Initialized Level ${bossLevel} AI (Difficulty: ${this.difficulty})`
    );
  }

  // ================ CORE AI LOGIC ================

  selectAction(boss, players, gameState) {
    // Update AI state
    this.updateAIState(boss, players, gameState);

    // Select attack based on current strategy
    const availableAttacks = boss.attacks.filter((attack) =>
      this.canUseAttack(attack, boss)
    );
    const selectedAttack = this.chooseAttack(availableAttacks, players, boss);

    // Select target(s)
    const targets = this.selectTargets(selectedAttack, players, boss);

    // Apply AI personality modifiers
    const action = this.applyPersonalityModifiers({
      type: 'boss_attack',
      attack: selectedAttack,
      targets: targets,
      reasoning: this.getLastDecisionReasoning(),
    });

    console.log(
      `[RaidBossAI] Selected action: ${action.attack.name} targeting ${action.targets.length} player(s)`
    );

    return action;
  }

  updateAIState(boss, players, gameState) {
    // Update health threshold
    this.state.healthThreshold = boss.currentHP / boss.maxHP;

    // Check for enrage mode (below 25% health)
    this.state.enrageMode = this.state.healthThreshold < 0.25;

    // Update aggro target (player who dealt most damage recently)
    this.updateAggroTarget(players, gameState);

    // Adapt strategy based on situation
    this.adaptStrategy(boss, players, gameState);
  }

  updateAggroTarget(players, gameState) {
    // Simple aggro system - target player with highest recent damage
    let highestDamage = 0;
    let aggroTarget = null;

    players.forEach((player) => {
      const recentDamage = this.calculateRecentDamage(player, gameState);
      if (recentDamage > highestDamage) {
        highestDamage = recentDamage;
        aggroTarget = player;
      }
    });

    if (aggroTarget && aggroTarget !== this.state.aggroTarget) {
      this.state.aggroTarget = aggroTarget;
      console.log(`[RaidBossAI] Aggro switched to ${aggroTarget.username}`);
    }
  }

  adaptStrategy(boss, players, gameState) {
    const activePlayers = players.filter((p) => p.status === 'active');

    // Defensive strategy when low health
    if (this.state.healthThreshold < 0.3) {
      this.state.attackPattern = 'defensive';
    }
    // Aggressive when players are weak
    else if (
      activePlayers.every(
        (p) => p.pokemon.active.currentHP < p.pokemon.active.maxHP * 0.5
      )
    ) {
      this.state.attackPattern = 'aggressive';
    }
    // Adaptive otherwise
    else {
      this.state.attackPattern = 'adaptive';
    }
  }

  // ================ ATTACK SELECTION ================

  chooseAttack(availableAttacks, players, boss) {
    const activePlayers = players.filter((p) => p.status === 'active');
    const situation = this.analyzeSituation(activePlayers, boss);

    // Weight attacks based on situation
    const weightedAttacks = availableAttacks.map((attack) => ({
      attack,
      weight: this.calculateAttackWeight(attack, situation, boss),
    }));

    // Sort by weight and add some randomness
    weightedAttacks.sort((a, b) => b.weight - a.weight);

    // Apply AI difficulty - higher difficulty = more optimal choices
    const selectionIndex = this.selectWithDifficulty(weightedAttacks.length);

    this.lastDecisionReasoning = this.explainAttackChoice(
      weightedAttacks[selectionIndex].attack,
      situation
    );

    return weightedAttacks[selectionIndex].attack;
  }

  calculateAttackWeight(attack, situation, boss) {
    let weight = attack.damage || 50; // Base weight from damage

    // Situation modifiers
    if (situation.playerCount > 2 && attack.targets === 'all') {
      weight += 30; // Prefer AoE with multiple targets
    }

    if (situation.playerCount === 1 && attack.targets === 1) {
      weight += 20; // Prefer single target with one player
    }

    if (situation.averagePlayerHP < 0.3 && attack.damage > 80) {
      weight += 25; // Prefer finishing moves on weak players
    }

    if (this.state.healthThreshold < 0.5 && attack.name.includes('Heal')) {
      weight += 40; // Prefer healing when boss is weak
    }

    // Pattern prevention - avoid using same attack repeatedly
    if (this.state.lastAttackUsed === attack.name) {
      weight -= 15;
    }

    if (this.state.consecutiveAttacks > 2) {
      weight -= 10 * this.state.consecutiveAttacks;
    }

    // Enrage mode modifiers
    if (this.state.enrageMode) {
      weight += attack.damage * 0.3; // Prefer high damage in enrage
    }

    // Apply strategy modifiers
    switch (this.state.attackPattern) {
      case 'aggressive':
        weight += attack.damage * 0.4;
        break;
      case 'defensive':
        if (attack.name.includes('Heal') || attack.name.includes('Shield')) {
          weight += 30;
        }
        break;
      case 'adaptive':
        // Balanced weighting already applied above
        break;
    }

    return Math.max(weight, 0);
  }

  selectTargets(attack, players, boss) {
    const activePlayers = players.filter((p) => p.status === 'active');

    if (attack.targets === 'all') {
      return activePlayers;
    }

    if (attack.targets === 1) {
      return [this.selectSingleTarget(activePlayers, attack, boss)];
    }

    // Multi-target but not all
    const targetCount = Math.min(attack.targets, activePlayers.length);
    return this.selectMultipleTargets(activePlayers, targetCount, attack, boss);
  }

  selectSingleTarget(players, attack, boss) {
    // Priority system for target selection
    const targetScores = players.map((player) => ({
      player,
      score: this.calculateTargetScore(player, attack, boss),
    }));

    targetScores.sort((a, b) => b.score - a.score);

    // Add some randomness based on difficulty
    const maxIndex = Math.min(
      targetScores.length,
      Math.ceil(targetScores.length * (1 - this.difficulty * 0.5))
    );
    const selectedIndex = Math.floor(Math.random() * maxIndex);

    return targetScores[selectedIndex].player;
  }

  calculateTargetScore(player, attack, boss) {
    let score = 0;

    // Aggro modifier
    if (player === this.state.aggroTarget) {
      score += 30;
    }

    // Health-based targeting
    const playerHP =
      player.pokemon.active.currentHP / player.pokemon.active.maxHP;

    if (attack.damage >= player.pokemon.active.currentHP) {
      score += 40; // Prioritize potential KOs
    }

    if (playerHP < 0.3) {
      score += 20; // Target weak players
    }

    // Type effectiveness (simplified)
    if (attack.type && player.pokemon.active.type) {
      const effectiveness = this.getTypeEffectiveness(
        attack.type,
        player.pokemon.active.type
      );
      score += effectiveness * 15;
    }

    // Random factor
    score += Math.random() * 10;

    return score;
  }

  // ================ UTILITY METHODS ================

  analyzeSituation(players, boss) {
    const totalPlayerHP = players.reduce(
      (sum, p) => sum + p.pokemon.active.currentHP,
      0
    );
    const maxPlayerHP = players.reduce(
      (sum, p) => sum + p.pokemon.active.maxHP,
      0
    );

    return {
      playerCount: players.length,
      averagePlayerHP: maxPlayerHP > 0 ? totalPlayerHP / maxPlayerHP : 0,
      bossHP: boss.currentHP / boss.maxHP,
      threatLevel: this.calculateThreatLevel(players),
      gamePhase: this.determineGamePhase(boss, players),
    };
  }

  calculateThreatLevel(players) {
    // Calculate how dangerous the players are currently
    let threat = 0;

    players.forEach((player) => {
      const pokemon = player.pokemon.active;
      const hpRatio = pokemon.currentHP / pokemon.maxHP;
      const avgDamage =
        pokemon.attacks.reduce((sum, attack) => sum + attack.damage, 0) /
        pokemon.attacks.length;

      threat += hpRatio * avgDamage;
    });

    return threat / players.length;
  }

  determineGamePhase(boss, players) {
    const bossHP = boss.currentHP / boss.maxHP;
    const avgPlayerHP =
      players.reduce(
        (sum, p) => sum + p.pokemon.active.currentHP / p.pokemon.active.maxHP,
        0
      ) / players.length;

    if (bossHP > 0.7) return 'early';
    if (bossHP > 0.3) return 'mid';
    if (bossHP > 0.1 || avgPlayerHP < 0.3) return 'late';
    return 'critical';
  }

  calculateDifficulty(level) {
    // Convert level to difficulty factor (0.0 to 1.0)
    return Math.min(0.2 + level * 0.2, 1.0);
  }

  selectWithDifficulty(optionCount) {
    // Higher difficulty = more optimal choices
    const randomFactor = 1 - this.difficulty;
    const maxIndex = Math.ceil(optionCount * (randomFactor * 0.5 + 0.5));
    return Math.floor(Math.random() * Math.max(maxIndex, 1));
  }

  canUseAttack(attack, boss) {
    // Check if boss can use this attack (cooldowns, energy, etc.)
    if (attack.cooldown && attack.lastUsed) {
      const timeSinceUsed = Date.now() - attack.lastUsed;
      if (timeSinceUsed < attack.cooldown * 1000) {
        return false;
      }
    }

    return true;
  }

  calculateRecentDamage(player, gameState) {
    // Calculate damage dealt by this player in recent turns
    if (!gameState.turnHistory) return 0;

    const recentTurns = gameState.turnHistory.slice(-3); // Last 3 turns
    return recentTurns
      .filter(
        (turn) => turn.playerId === player.id && turn.action.type === 'attack'
      )
      .reduce((sum, turn) => sum + (turn.result.damage || 0), 0);
  }

  getTypeEffectiveness(attackType, defenderType) {
    // Simplified type chart
    const effectiveness = {
      fire: { grass: 2.0, water: 0.5 },
      water: { fire: 2.0, grass: 0.5 },
      grass: { water: 2.0, fire: 0.5 },
      electric: { water: 2.0, flying: 2.0 },
    };

    return effectiveness[attackType]?.[defenderType] || 1.0;
  }

  // ================ PERSONALITY SYSTEMS ================

  applyPersonalityModifiers(action) {
    // Add boss personality traits based on level and type
    const personality = this.getBossPersonality();

    if (personality.aggressive && action.attack.damage) {
      action.attack = {
        ...action.attack,
        damage: Math.floor(action.attack.damage * 1.1),
      };
    }

    if (personality.tactical && Math.random() < 0.3) {
      action.delayTurn = true; // Sometimes delay to observe player actions
    }

    return action;
  }

  getBossPersonality() {
    const personalities = {
      1: { name: 'Aggressive', aggressive: true, tactical: false },
      2: { name: 'Tactical', aggressive: false, tactical: true },
      3: { name: 'Ruthless', aggressive: true, tactical: true },
    };

    return personalities[this.level] || personalities[1];
  }

  explainAttackChoice(attack, situation) {
    const reasons = [];

    if (situation.playerCount > 2 && attack.targets === 'all') {
      reasons.push('Multiple targets available for AoE');
    }

    if (this.state.healthThreshold < 0.3) {
      reasons.push('Boss in critical health');
    }

    if (this.state.aggroTarget) {
      reasons.push(`High aggro on ${this.state.aggroTarget.username}`);
    }

    if (this.state.enrageMode) {
      reasons.push('Enrage mode active');
    }

    return reasons.join(', ') || 'Standard attack pattern';
  }

  getLastDecisionReasoning() {
    return this.lastDecisionReasoning || 'No reasoning available';
  }

  // ================ DEBUG METHODS ================

  setAggro(playerId) {
    this.state.aggroTarget = { id: playerId };
    console.log(`[RaidBossAI] Forced aggro to player ${playerId}`);
  }

  setStrategy(strategy) {
    this.state.attackPattern = strategy;
    console.log(`[RaidBossAI] Strategy changed to ${strategy}`);
  }

  getAIStatus() {
    return {
      level: this.level,
      difficulty: this.difficulty,
      state: this.state,
      personality: this.getBossPersonality(),
    };
  }

  selectMultipleTargets(players, count, attack, boss) {
    const scored = players.map((player) => ({
      player,
      score: this.calculateTargetScore(player, attack, boss),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map((item) => item.player);
  }
}
