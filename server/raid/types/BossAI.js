// ===================================================================
// File: server/raid/types/BossAI.js
// Path: /server/raid/types/BossAI.js
// Location: Server-side boss AI and decision making
// Changes: Initial scripted boss AI with future player control support
// Dependencies: TCGOfficialGameState.js
// Dependents: ../core/RaidSocketHandler.js, future PlayerControlledBoss.js
// Changelog: 
//   v1.0.0 - Initial scripted AI following Boss Attack Deck rules
//   v1.0.1 - Added smart targeting and threat assessment
//   v1.0.2 - Added foundation for future player control mode
// Version: 1.0.2
// ===================================================================

export class BossAI {
    constructor(gameState) {
      this.gameState = gameState;
      this.aiMode = 'scripted'; // scripted, playerControlled, adaptive
      this.difficulty = 'normal'; // easy, normal, hard
      
      // AI behavior settings
      this.behaviorSettings = {
        targetPriority: 'weakest', // weakest, strongest, random, tactical
        attackPattern: 'deckBased', // deckBased, strategic, aggressive
        useAdvancedTactics: false,
        adaptToPlayerBehavior: false
      };
      
      // Player control settings (for future implementation)
      this.playerControlSettings = {
        controllingPlayerId: null,
        allowTargetOverride: true,
        allowAttackSelection: true,
        timeLimit: 30000 // 30 seconds per decision
      };
      
      this.decisionHistory = [];
      this.threatAssessment = new Map();
      this.lastDecisionTime = Date.now();
    }
  
    // ================ MAIN AI ENTRY POINT ================
  
    generateBossActions() {
      this.lastDecisionTime = Date.now();
      
      if (this.aiMode === 'playerControlled') {
        return this.handlePlayerControlledTurn();
      } else {
        return this.handleScriptedTurn();
      }
    }
  
    handleScriptedTurn() {
      const actions = [];
      let attacksToPerform = this.gameState.boss.maxAttacksPerTurn;
      
      // Update threat assessment
      this.updateThreatAssessment();
      
      while (attacksToPerform > 0 && this.gameState.bossAttackDeck.length > 0) {
        const attackCard = this.drawBossAttackCard();
        if (!attackCard) break;
        
        // Apply AI modifications to the attack
        const modifiedAttack = this.applyAIModifications(attackCard);
        actions.push(modifiedAttack);
        
        attacksToPerform--;
        
        // Check if we should draw another card
        if (!modifiedAttack.drawAnother) break;
      }
      
      // Log AI decision
      this.logDecision('scriptedTurn', {
        actionsGenerated: actions.length,
        threatLevel: this.calculateOverallThreat(),
        targetingStrategy: this.behaviorSettings.targetPriority
      });
      
      return actions;
    }
  
    handlePlayerControlledTurn() {
      // Future implementation for player-controlled boss
      // For now, fall back to scripted behavior
      this.logDecision('playerControlFallback', {
        reason: 'Player control not yet implemented',
        controllerId: this.playerControlSettings.controllingPlayerId
      });
      
      return this.handleScriptedTurn();
    }
  
    // ================ BOSS ATTACK DECK MANAGEMENT ================
  
    drawBossAttackCard() {
      if (this.gameState.bossAttackDeck.length === 0) {
        this.reshuffleBossAttackDeck();
      }
      
      if (this.gameState.bossAttackDeck.length === 0) {
        return null; // No cards available
      }
      
      const card = this.gameState.bossAttackDeck.pop();
      this.gameState.bossAttackDiscard.push(card);
      
      return card;
    }
  
    reshuffleBossAttackDeck() {
      if (this.gameState.bossAttackDiscard.length === 0) return;
      
      this.gameState.bossAttackDeck = this.shuffleArray([...this.gameState.bossAttackDiscard]);
      this.gameState.bossAttackDiscard = [];
      
      this.logDecision('deckReshuffled', {
        cardsShuffled: this.gameState.bossAttackDeck.length
      });
    }
  
    // ================ AI MODIFICATIONS ================
  
    applyAIModifications(baseAttackCard) {
      let modifiedAttack = { ...baseAttackCard };
      
      // Apply targeting modifications
      modifiedAttack = this.applySmartTargeting(modifiedAttack);
      
      // Apply difficulty adjustments
      modifiedAttack = this.applyDifficultyModifications(modifiedAttack);
      
      // Apply behavioral patterns
      modifiedAttack = this.applyBehavioralModifications(modifiedAttack);
      
      return modifiedAttack;
    }
  
    applySmartTargeting(attackCard) {
      if (this.behaviorSettings.targetPriority === 'deckBased') {
        return attackCard; // Use card's original target
      }
      
      const activePlayers = Array.from(this.gameState.players.entries())
        .filter(([id, player]) => player.status === 'active')
        .map(([id, player]) => ({ id, ...player }));
      
      if (activePlayers.length === 0) return attackCard;
      
      let targetPlayer;
      
      switch (this.behaviorSettings.targetPriority) {
        case 'weakest':
          targetPlayer = this.findWeakestPlayer(activePlayers);
          break;
        case 'strongest':
          targetPlayer = this.findStrongestPlayer(activePlayers);
          break;
        case 'tactical':
          targetPlayer = this.findTacticalTarget(activePlayers);
          break;
        case 'random':
        default:
          targetPlayer = activePlayers[Math.floor(Math.random() * activePlayers.length)];
          break;
      }
      
      if (targetPlayer) {
        const playerIndex = activePlayers.findIndex(p => p.id === targetPlayer.id);
        attackCard.targetPlayer = playerIndex + 1;
        attackCard.originalTarget = attackCard.targetPlayer;
        attackCard.targetingReason = this.behaviorSettings.targetPriority;
      }
      
      return attackCard;
    }
  
    findWeakestPlayer(players) {
      return players.reduce((weakest, player) => {
        const playerHP = player.pokemon.active.hp;
        const weakestHP = weakest ? weakest.pokemon.active.hp : Infinity;
        return playerHP < weakestHP ? player : weakest;
      }, null);
    }
  
    findStrongestPlayer(players) {
      return players.reduce((strongest, player) => {
        const playerHP = player.pokemon.active.hp;
        const strongestHP = strongest ? strongest.pokemon.active.hp : 0;
        return playerHP > strongestHP ? player : strongest;
      }, null);
    }
  
    findTacticalTarget(players) {
      // Target based on threat assessment and game state
      let bestTarget = null;
      let highestThreatScore = 0;
      
      players.forEach(player => {
        const threat = this.threatAssessment.get(player.id) || 0;
        const hp = player.pokemon.active.hp;
        const koThreshold = 50; // If we can KO with this attack
        
        let score = threat;
        
        // Prioritize near-KO targets
        if (hp <= koThreshold) {
          score += 100;
        }
        
        // Factor in if they can use cheer
        if (player.canUseCheer) {
          score += 50;
        }
        
        if (score > highestThreatScore) {
          highestThreatScore = score;
          bestTarget = player;
        }
      });
      
      return bestTarget || this.findWeakestPlayer(players);
    }
  
    applyDifficultyModifications(attackCard) {
      switch (this.difficulty) {
        case 'easy':
          // Reduce damage slightly
          attackCard.damage = Math.floor(attackCard.damage * 0.8);
          // Less likely to draw another card
          if (Math.random() < 0.3) {
            attackCard.drawAnother = false;
          }
          break;
          
        case 'hard':
          // Increase damage slightly  
          attackCard.damage = Math.floor(attackCard.damage * 1.2);
          // More likely to draw another card
          if (attackCard.attackNumber <= 2 && Math.random() < 0.7) {
            attackCard.drawAnother = true;
          }
          break;
          
        case 'normal':
        default:
          // No modifications
          break;
      }
      
      return attackCard;
    }
  
    applyBehavioralModifications(attackCard) {
      if (this.behaviorSettings.attackPattern === 'aggressive') {
        // Prefer higher damage attacks
        if (attackCard.attackNumber === 1 && Math.random() < 0.4) {
          attackCard.attackNumber = 2;
          attackCard.damage = 60;
        }
      } else if (this.behaviorSettings.attackPattern === 'strategic') {
        // Consider game state for attack selection
        const lowHPPlayers = Array.from(this.gameState.players.values())
          .filter(p => p.status === 'active' && p.pokemon.active.hp <= 40).length;
        
        if (lowHPPlayers >= 2 && attackCard.attackNumber === 3) {
          // Use weaker attacks to spread damage instead of overkill
          attackCard.attackNumber = 1;
          attackCard.damage = 30;
          attackCard.drawAnother = true;
        }
      }
      
      return attackCard;
    }
  
    // ================ THREAT ASSESSMENT ================
  
    updateThreatAssessment() {
      this.gameState.players.forEach((player, playerId) => {
        if (player.status !== 'active') {
          this.threatAssessment.set(playerId, 0);
          return;
        }
        
        let threatLevel = 0;
        
        // Base threat from pokemon damage potential
        const activePokemon = player.pokemon.active;
        const maxDamage = Math.max(...activePokemon.attacks.map(a => a.damage));
        threatLevel += maxDamage;
        
        // Threat from remaining HP (higher HP = higher threat)
        threatLevel += activePokemon.hp * 0.5;
        
        // Threat from available actions
        if (player.canUseCheer) {
          threatLevel += 50;
        }
        
        // Historical threat (if they've been dealing consistent damage)
        if (player.lastAction && player.lastAction.type === 'attack') {
          threatLevel += player.lastAction.damage * 0.3;
        }
        
        this.threatAssessment.set(playerId, threatLevel);
      });
    }
  
    calculateOverallThreat() {
      let totalThreat = 0;
      this.threatAssessment.forEach(threat => {
        totalThreat += threat;
      });
      return totalThreat;
    }
  
    // ================ LOGGING & HISTORY ================
  
    logDecision(type, data) {
      const decision = {
        type: type,
        data: data,
        gameState: {
          bossHP: this.gameState.boss.currentHP,
          totalKOs: this.gameState.totalKOCount,
          activePlayers: this.gameState.getActivePlayerCount()
        },
        threatAssessment: Object.fromEntries(this.threatAssessment),
        timestamp: this.lastDecisionTime
      };
      
      this.decisionHistory.push(decision);
      
      // Limit history size
      if (this.decisionHistory.length > 20) {
        this.decisionHistory = this.decisionHistory.slice(-20);
      }
      
      // Queue for spectators
      if (this.gameState.spectatorManager) {
        this.gameState.spectatorManager.logEvent({
          type: 'bossAIDecision',
          decision: decision,
          timestamp: this.lastDecisionTime
        });
      }
    }
  
    // ================ CONFIGURATION ================
  
    setAIMode(mode) {
      this.aiMode = mode;
      this.logDecision('modeChanged', { newMode: mode });
    }
  
    setDifficulty(difficulty) {
      this.difficulty = difficulty;
      this.logDecision('difficultyChanged', { newDifficulty: difficulty });
    }
  
    updateBehaviorSettings(newSettings) {
      this.behaviorSettings = { ...this.behaviorSettings, ...newSettings };
      this.logDecision('behaviorChanged', { newSettings: this.behaviorSettings });
    }
  
    // Future: Enable player control
    enablePlayerControl(playerId) {
      this.aiMode = 'playerControlled';
      this.playerControlSettings.controllingPlayerId = playerId;
      
      this.logDecision('playerControlEnabled', {
        controllerId: playerId,
        timeLimit: this.playerControlSettings.timeLimit
      });
    }
  
    disablePlayerControl() {
      this.aiMode = 'scripted';
      this.playerControlSettings.controllingPlayerId = null;
      
      this.logDecision('playerControlDisabled', {});
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
  
    getBossAIState() {
      return {
        mode: this.aiMode,
        difficulty: this.difficulty,
        behaviorSettings: this.behaviorSettings,
        playerControlSettings: this.playerControlSettings,
        threatAssessment: Object.fromEntries(this.threatAssessment),
        recentDecisions: this.decisionHistory.slice(-5),
        lastDecisionTime: this.lastDecisionTime
      };
    }
  }