// ===================================================================
// File: server/raid/core/RaidCombatSystem.js
// Path: /server/raid/core/RaidCombatSystem.js
// Purpose: Combat calculations and battle mechanics for raid system
// Version: 1.0.0
//
// Dependencies:
//   - None (pure calculation logic)
//
// Used By:
//   - ./RaidGameEngine.js
//   - ./RaidBossAI.js
//
// Changelog:
//   v1.0.0 - Initial implementation with damage calculations
// ===================================================================

export class RaidCombatSystem {
  constructor() {
    this.damageMultipliers = {
      normal: 1.0,
      superEffective: 2.0,
      notVeryEffective: 0.5,
      noEffect: 0.0,
    };

    this.statusEffects = {
      paralyzed: { name: 'Paralyzed', duration: 2, effect: 'skip_turn' },
      poisoned: {
        name: 'Poisoned',
        duration: 3,
        effect: 'damage_over_time',
        damage: 10,
      },
      confused: { name: 'Confused', duration: 2, effect: 'random_target' },
      asleep: { name: 'Asleep', duration: 2, effect: 'skip_turn' },
    };

    console.log('[RaidCombatSystem] Initialized');
  }

  // ================ DAMAGE CALCULATIONS ================

  calculateDamage(attacker, defender, attack, modifiers = {}) {
    let baseDamage = attack.damage || 0;

    // Apply weakness/resistance (simplified)
    let typeMultiplier = this.getTypeEffectiveness(attack.type, defender.type);

    // Apply random variance (±10%)
    let variance = 0.9 + Math.random() * 0.2;

    // Apply modifiers
    let damage = Math.floor(baseDamage * typeMultiplier * variance);

    // Apply additional modifiers
    if (modifiers.cheerCard) damage = Math.floor(damage * 1.2);
    if (modifiers.critical) damage = Math.floor(damage * 1.5);
    if (modifiers.gxAttack) damage = Math.floor(damage * 1.8);

    // Minimum damage is 1 (unless no effect)
    if (damage > 0 && damage < 1) damage = 1;
    if (typeMultiplier === 0) damage = 0;

    return {
      damage: damage,
      typeMultiplier: typeMultiplier,
      variance: variance,
      modifiers: modifiers,
      isCritical: modifiers.critical || false,
    };
  }

  getTypeEffectiveness(attackType, defenderType) {
    // Simplified type chart - in a real implementation this would be more complex
    const typeChart = {
      fire: { grass: 2.0, water: 0.5, fire: 0.5 },
      water: { fire: 2.0, grass: 0.5, water: 0.5 },
      grass: { water: 2.0, fire: 0.5, grass: 0.5 },
      electric: { water: 2.0, flying: 2.0, electric: 0.5, ground: 0.0 },
      psychic: { fighting: 2.0, poison: 2.0, psychic: 0.5, dark: 0.0 },
      fighting: {
        normal: 2.0,
        rock: 2.0,
        steel: 2.0,
        psychic: 0.5,
        flying: 0.5,
        ghost: 0.0,
      },
    };

    if (!attackType || !defenderType) return 1.0;

    const effectiveness = typeChart[attackType]?.[defenderType];
    return effectiveness !== undefined ? effectiveness : 1.0;
  }

  // ================ POKEMON INTERACTIONS ================

  applyDamage(pokemon, damageResult) {
    const actualDamage = Math.min(damageResult.damage, pokemon.currentHP);
    pokemon.currentHP = Math.max(0, pokemon.currentHP - actualDamage);

    const result = {
      damageDealt: actualDamage,
      newHP: pokemon.currentHP,
      isKO: pokemon.currentHP === 0,
      wasHealed: false,
    };

    if (result.isKO) {
      pokemon.status = 'ko';
    }

    return result;
  }

  healPokemon(pokemon, healAmount) {
    const actualHeal = Math.min(healAmount, pokemon.maxHP - pokemon.currentHP);
    pokemon.currentHP = Math.min(pokemon.maxHP, pokemon.currentHP + actualHeal);

    return {
      healAmount: actualHeal,
      newHP: pokemon.currentHP,
      wasHealed: actualHeal > 0,
      isFullyHealed: pokemon.currentHP === pokemon.maxHP,
    };
  }

  applyStatusEffect(pokemon, effectName, duration = null) {
    const effect = this.statusEffects[effectName];
    if (!effect) return { success: false, error: 'Unknown status effect' };

    if (!pokemon.statusEffects) pokemon.statusEffects = [];

    // Remove existing effect of same type
    pokemon.statusEffects = pokemon.statusEffects.filter(
      (e) => e.name !== effectName
    );

    // Add new effect
    pokemon.statusEffects.push({
      ...effect,
      duration: duration || effect.duration,
      appliedAt: Date.now(),
    });

    return {
      success: true,
      effect: effectName,
      duration: duration || effect.duration,
    };
  }

  removeStatusEffect(pokemon, effectName) {
    if (!pokemon.statusEffects) return false;

    const beforeLength = pokemon.statusEffects.length;
    pokemon.statusEffects = pokemon.statusEffects.filter(
      (e) => e.name !== effectName
    );

    return pokemon.statusEffects.length < beforeLength;
  }

  processStatusEffects(pokemon) {
    if (!pokemon.statusEffects || pokemon.statusEffects.length === 0) {
      return { effects: [], damage: 0 };
    }

    const results = [];
    let totalDamage = 0;

    // Process each effect
    pokemon.statusEffects.forEach((effect) => {
      effect.duration--;

      const result = { name: effect.name, duration: effect.duration };

      // Apply effect
      switch (effect.effect) {
        case 'damage_over_time':
          const damage = effect.damage || 10;
          pokemon.currentHP = Math.max(0, pokemon.currentHP - damage);
          totalDamage += damage;
          result.damage = damage;
          result.newHP = pokemon.currentHP;
          break;

        case 'skip_turn':
          result.skipTurn = true;
          break;

        case 'random_target':
          result.confusionActive = true;
          break;
      }

      results.push(result);
    });

    // Remove expired effects
    pokemon.statusEffects = pokemon.statusEffects.filter((e) => e.duration > 0);

    return { effects: results, damage: totalDamage };
  }

  // ================ SPECIAL MECHANICS ================

  calculateCheerCardEffect(attack, cheerType) {
    const cheerEffects = {
      damage: { multiplier: 1.2, description: '+20% damage' },
      heal: { heal: 30, description: 'Heal 30 HP' },
      energy: { energyBoost: 1, description: '+1 energy this turn' },
      protection: {
        damageReduction: 0.5,
        description: '50% damage reduction next turn',
      },
    };

    return cheerEffects[cheerType] || cheerEffects.damage;
  }

  processRetreat(activePokemon, benchPokemon) {
    if (activePokemon.status === 'ko') {
      return { success: false, error: "Cannot retreat KO'd Pokémon" };
    }

    if (benchPokemon.status === 'ko') {
      return { success: false, error: "Cannot retreat to KO'd Pokémon" };
    }

    // Swap statuses
    const tempStatus = activePokemon.status;
    activePokemon.status = benchPokemon.status;
    benchPokemon.status = tempStatus;

    // Clear some status effects on retreat
    if (activePokemon.statusEffects) {
      activePokemon.statusEffects = activePokemon.statusEffects.filter(
        (e) => e.name !== 'confused' && e.name !== 'paralyzed'
      );
    }

    return {
      success: true,
      newActive: benchPokemon,
      newBench: activePokemon,
    };
  }

  // ================ BOSS COMBAT ================

  calculateBossAttack(boss, targetPlayer, attack) {
    const bossAttacker = {
      level: boss.level,
      type: 'dragon', // Boss is always dragon type
    };

    const target = targetPlayer.pokemon.active;

    // Boss attacks are more powerful
    const modifiedAttack = {
      ...attack,
      damage: attack.damage * (1 + boss.level * 0.2), // +20% per level
    };

    return this.calculateDamage(bossAttacker, target, modifiedAttack, {
      bossAttack: true,
    });
  }

  calculateBossAoEDamage(boss, players, attack) {
    const results = [];

    players.forEach((player) => {
      if (player.status === 'active') {
        const damageResult = this.calculateBossAttack(boss, player, attack);

        // AoE attacks do 75% damage
        damageResult.damage = Math.floor(damageResult.damage * 0.75);

        results.push({
          playerId: player.id,
          damageResult: damageResult,
        });
      }
    });

    return results;
  }

  // ================ UTILITY METHODS ================

  getRandomTarget(players) {
    const activePlayers = players.filter((p) => p.status === 'active');
    if (activePlayers.length === 0) return null;

    return activePlayers[Math.floor(Math.random() * activePlayers.length)];
  }

  isGameOver(boss, players) {
    // Victory: Boss defeated
    if (boss.currentHP <= 0) {
      return { gameOver: true, result: 'victory', reason: 'Boss defeated' };
    }

    // Defeat: All players KO'd
    const activePlayers = players.filter((p) => p.status === 'active');
    if (activePlayers.length === 0) {
      return {
        gameOver: true,
        result: 'defeat',
        reason: 'All players defeated',
      };
    }

    // Continue playing
    return { gameOver: false };
  }

  // ================ DEBUG METHODS ================

  setHP(pokemon, newHP) {
    pokemon.currentHP = Math.max(0, Math.min(newHP, pokemon.maxHP));
    pokemon.status = pokemon.currentHP > 0 ? 'active' : 'ko';
    return pokemon.currentHP;
  }

  simulateBattle(attacker, defender, attack, iterations = 1000) {
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const damageResult = this.calculateDamage(attacker, defender, attack);
      results.push(damageResult.damage);
    }

    return {
      average: results.reduce((a, b) => a + b, 0) / results.length,
      min: Math.min(...results),
      max: Math.max(...results),
      results: results,
    };
  }
}
