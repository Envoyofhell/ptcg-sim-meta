  // server/raid/types/TCGOfficialRaid.js
  // Specific implementation for TCG Official raids
  
  export class TCGOfficialRaid {
    initializeGameState(config) {
      return {
        koCounters: 0,
        maxKOCounters: 4,
        cheerCardsUsed: 0,
        maxCheerCards: 3,
        bossAttackDeck: this.createBossAttackDeck(),
        bossAttackDiscard: [],
        bossLevel: null // Will be calculated when raid starts
      };
    }
  
    createBoss(config, players) {
      // Calculate boss level based on player Pokemon damage
      const totalDamage = this.calculateTotalPlayerDamage(players);
      const level = this.determineBossLevel(totalDamage);
      
      return {
        card: config.bossCard,
        level: level,
        hp: config.bossCard.hp[level], // Different HP per level
        maxHP: config.bossCard.hp[level],
        maxAttacksPerTurn: level === 1 ? 2 : level === 2 ? 3 : 4
      };
    }
  
    calculateTotalPlayerDamage(players) {
      let total = 0;
      players.forEach(player => {
        // Get highest damage attack from each player's 2 Pokemon
        const pokemon1Damage = Math.max(...player.pokemon[0].attacks.map(a => a.damage));
        const pokemon2Damage = Math.max(...player.pokemon[1].attacks.map(a => a.damage));
        total += Math.max(pokemon1Damage, pokemon2Damage);
      });
      return total;
    }
  
    determineBossLevel(totalDamage) {
      if (totalDamage < 250) return 1; // Should choose stronger Pokemon
      if (totalDamage <= 390) return 1;
      if (totalDamage <= 590) return 2;
      return 3;
    }
  
    createBossAttackDeck() {
      // Generate the 20-card boss attack deck based on the rules
      const deck = [];
      const playerCount = 4; // Assume max for now
      
      // Attack 1 cards (always draw another) - 6 per player
      for (let player = 1; player <= playerCount; player++) {
        for (let i = 0; i < 6; i++) {
          deck.push({
            attackNumber: 1,
            targetPlayer: player,
            drawAnother: true
          });
        }
      }
      
      // Attack 2 cards (50% draw another) - 3 per player  
      for (let player = 1; player <= playerCount; player++) {
        for (let i = 0; i < 3; i++) {
          deck.push({
            attackNumber: 2,
            targetPlayer: player,
            drawAnother: Math.random() < 0.5
          });
        }
      }
      
      // Attack 3 cards (25% draw another) - 1 per player
      for (let player = 1; player <= playerCount; player++) {
        deck.push({
          attackNumber: 3,
          targetPlayer: player,
          drawAnother: Math.random() < 0.25
        });
      }
      
      return this.shuffleArray(deck);
    }
  
    processAction(gameState, player, action) {
      switch (action.type) {
        case 'attack':
          return this.processPlayerAttack(gameState, player, action);
        case 'retreat':
          return this.processRetreat(gameState, player, action);
        case 'cheer':
          return this.processCheerCard(gameState, player, action);
        default:
          return { success: false, error: 'Unknown action type' };
      }
    }
  
    processPlayerAttack(gameState, player, action) {
      // Handle player attacking the boss
      const damage = action.damage;
      
      // Apply damage to boss
      gameState.boss.hp -= damage;
      
      return {
        success: true,
        damage: damage,
        newBossHP: gameState.boss.hp,
        message: `${player.name} dealt ${damage} damage to the boss`
      };
    }
  
    processCheerCard(gameState, player, action) {
      if (gameState.cheerCardsUsed >= gameState.maxCheerCards) {
        return { success: false, error: 'Maximum cheer cards already used' };
      }
  
      gameState.cheerCardsUsed++;
      
      // Apply cheer card effect based on the 5 official effects
      const effect = this.applyCheerCardEffect(action.cheerCardNumber, gameState, player);
      
      return {
        success: true,
        effect: effect,
        cheerCardsUsed: gameState.cheerCardsUsed
      };
    }
  
    generateBossAction(gameState, players) {
      // Draw boss attack card and execute
      if (gameState.bossAttackDeck.length === 0) {
        // Reshuffle discard pile
        gameState.bossAttackDeck = this.shuffleArray(gameState.bossAttackDiscard);
        gameState.bossAttackDiscard = [];
      }
  
      const attackCard = gameState.bossAttackDeck.pop();
      gameState.bossAttackDiscard.push(attackCard);
  
      return attackCard;
    }
  
    checkWinCondition(gameState) {
      return {
        hasWon: gameState.boss.hp <= 0,
        reason: gameState.boss.hp <= 0 ? 'Boss defeated!' : null
      };
    }
  
    checkLossCondition(gameState) {
      return {
        hasLost: gameState.koCounters >= gameState.maxKOCounters,
        reason: gameState.koCounters >= gameState.maxKOCounters ? 'Too many Pokemon KO\'d' : null
      };
    }
  
    shuffleArray(array) {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }
  }