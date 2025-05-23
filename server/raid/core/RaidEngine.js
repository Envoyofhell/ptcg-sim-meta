// server/raid/core/RaidEngine.js
// Main serverside raid battle engine - completely modular and expandable

export class RaidEngine {
    constructor() {
      this.activeRaids = new Map();
      this.raidTypes = new Map();
      this.geometryManager = new RaidGeometryManager();
      this.eventBus = new RaidEventBus();
      
      // Register built-in raid types
      this.registerRaidType('tcg-official', new TCGOfficialRaid());
      this.registerRaidType('tcg-community', new TCGCommunityRaid());
      // Future: this.registerRaidType('pokemon-go', new PokeGORaid());
    }
  
    registerRaidType(typeId, raidTypeHandler) {
      this.raidTypes.set(typeId, raidTypeHandler);
    }
  
    createRaid(raidId, config) {
      const raidType = this.raidTypes.get(config.type);
      if (!raidType) throw new Error(`Unknown raid type: ${config.type}`);
  
      const raid = new RaidInstance(raidId, raidType, config, this.geometryManager);
      this.activeRaids.set(raidId, raid);
      
      // Calculate initial player positions using angular geometry
      this.geometryManager.calculatePlayerPositions(raid);
      
      return raid;
    }
  
    joinRaid(raidId, playerId, playerData) {
      const raid = this.activeRaids.get(raidId);
      if (!raid) throw new Error(`Raid ${raidId} not found`);
  
      const success = raid.addPlayer(playerId, playerData);
      if (success) {
        // Recalculate positions when player count changes
        this.geometryManager.recalculatePositions(raid);
        this.eventBus.emit('playerJoined', { raidId, playerId, raid });
      }
      
      return success;
    }
  
    processAction(raidId, playerId, action) {
      const raid = this.activeRaids.get(raidId);
      if (!raid) return false;
  
      const result = raid.processPlayerAction(playerId, action);
      
      if (result.success) {
        this.eventBus.emit('actionProcessed', { 
          raidId, 
          playerId, 
          action, 
          result,
          newState: raid.getState()
        });
      }
      
      return result;
    }
  }
  
  // server/raid/geometry/RaidGeometryManager.js
  // Handles all angular positioning and scaling logic
  
  export class RaidGeometryManager {
    constructor() {
      this.layouts = {
        // Circular layout - players around boss
        circular: {
          2: [0, 180],           // 2 players: opposite sides
          3: [0, 120, 240],      // 3 players: triangle
          4: [0, 90, 180, 270]   // 4 players: square
        },
        // Linear layout - players vs boss (using your angular concept)
        versus: {
          2: this.generateVersusAngles(2),
          3: this.generateVersusAngles(3), 
          4: this.generateVersusAngles(4)
        }
      };
    }
  
    generateVersusAngles(playerCount) {
      // Based on your image: distribute players across one side (0° to 90°)
      const startAngle = 15; // Start at 15° like your image
      const endAngle = 75;   // End at 75° like your image
      const angleSpread = endAngle - startAngle;
      
      if (playerCount === 1) return [45]; // Center position
      
      const angles = [];
      for (let i = 0; i < playerCount; i++) {
        const angle = startAngle + (angleSpread * i / (playerCount - 1));
        angles.push(angle);
      }
      return angles;
    }
  
    calculatePlayerPositions(raid) {
      const playerCount = raid.players.size;
      const layout = raid.config.layout || 'circular';
      const angles = this.layouts[layout][playerCount];
      
      if (!angles) {
        console.warn(`No layout defined for ${playerCount} players in ${layout} mode`);
        return;
      }
  
      const positions = [];
      const centerX = 50; // Percentage
      const centerY = 50;
      const radius = this.calculateRadius(playerCount, layout);
  
      angles.forEach((angle, index) => {
        const radians = (angle * Math.PI) / 180;
        const x = centerX + radius * Math.cos(radians);
        const y = centerY + radius * Math.sin(radians);
        
        positions.push({
          playerId: Array.from(raid.players.keys())[index],
          angle,
          x: Math.max(5, Math.min(95, x)), // Keep within bounds
          y: Math.max(5, Math.min(95, y)),
          overlapFactor: this.calculateOverlap(angle, angles) // From your image concept
        });
      });
  
      raid.playerPositions = positions;
      return positions;
    }
  
    calculateRadius(playerCount, layout) {
      // Scale radius based on player count to prevent overlap
      const baseRadius = layout === 'versus' ? 35 : 30;
      const scaleFactor = Math.max(1, playerCount / 4);
      return baseRadius * scaleFactor;
    }
  
    calculateOverlap(currentAngle, allAngles) {
      // Calculate overlap factor based on proximity to other players
      // This could be used for visual effects or collision detection
      let minDistance = 360;
      
      allAngles.forEach(angle => {
        if (angle !== currentAngle) {
          const distance = Math.abs(angle - currentAngle);
          minDistance = Math.min(minDistance, distance);
        }
      });
      
      // Convert to overlap factor (0 = no overlap, 1 = high overlap)
      return Math.max(0, 1 - (minDistance / 90));
    }
  
    recalculatePositions(raid) {
      this.calculatePlayerPositions(raid);
      
      // Emit position update event
      return {
        event: 'positionsUpdated',
        positions: raid.playerPositions,
        bossPosition: this.getBossPosition(raid)
      };
    }
  
    getBossPosition(raid) {
      const layout = raid.config.layout || 'circular';
      
      if (layout === 'versus') {
        // Boss on opposite side from players (around 225-315° range)
        return { x: 50, y: 15, angle: 270 }; // Top center for versus mode
      } else {
        // Boss in center for circular
        return { x: 50, y: 50, angle: 0 };
      }
    }
  
    // Support for your angular time/fraction concept
    getPositionAtTime(raid, timePercent) {
      // If raid has time-based mechanics, calculate positions over time
      const basePositions = raid.playerPositions;
      
      return basePositions.map(pos => ({
        ...pos,
        // Add time-based animation or rotation
        animatedAngle: pos.angle + (timePercent * 15), // Slight rotation over time
        fraction: this.calculateTimeFraction(pos.angle, timePercent)
      }));
    }
  
    calculateTimeFraction(angle, timePercent) {
      // Based on your analog clock concept - calculate what "fraction" of the battle this represents
      const normalizedAngle = (angle % 360) / 360;
      return (normalizedAngle + timePercent) % 1;
    }
  }
  
  // server/raid/core/RaidInstance.js
  // Individual raid instance that manages state and players
  
  export class RaidInstance {
    constructor(id, raidType, config, geometryManager) {
      this.id = id;
      this.type = raidType;
      this.config = config;
      this.geometryManager = geometryManager;
      
      this.state = 'lobby'; // lobby, active, victory, defeat
      this.players = new Map();
      this.playerPositions = [];
      this.boss = null;
      this.turnState = 'waiting';
      
      // Initialize raid-specific state
      this.gameState = this.type.initializeGameState(config);
    }
  
    addPlayer(playerId, playerData) {
      if (this.players.size >= this.config.maxPlayers) {
        return false;
      }
  
      if (this.state !== 'lobby') {
        return false; // Can't join active raids
      }
  
      this.players.set(playerId, {
        id: playerId,
        ...playerData,
        joinedAt: Date.now(),
        isReady: false
      });
  
      return true;
    }
  
    removePlayer(playerId) {
      const removed = this.players.delete(playerId);
      if (removed && this.players.size > 0) {
        // Recalculate positions when someone leaves
        this.geometryManager.recalculatePositions(this);
      }
      return removed;
    }
  
    startRaid() {
      if (this.players.size < this.config.minPlayers) {
        return { success: false, error: 'Not enough players' };
      }
  
      // Initialize boss based on raid type
      this.boss = this.type.createBoss(this.config, this.players);
      
      // Calculate initial positions
      this.geometryManager.calculatePlayerPositions(this);
      
      this.state = 'active';
      this.turnState = 'players';
      
      return { 
        success: true, 
        gameState: this.getState(),
        positions: this.playerPositions
      };
    }
  
    processPlayerAction(playerId, action) {
      if (this.state !== 'active') {
        return { success: false, error: 'Raid not active' };
      }
  
      const player = this.players.get(playerId);
      if (!player) {
        return { success: false, error: 'Player not found' };
      }
  
      // Process action through raid type handler
      const result = this.type.processAction(this.gameState, player, action);
      
      if (result.success) {
        // Check for state changes
        this.checkWinConditions();
        
        // Update positions if needed
        if (result.recalculatePositions) {
          this.geometryManager.recalculatePositions(this);
        }
      }
  
      return result;
    }
  
    processBossTurn() {
      if (this.turnState !== 'boss') return;
  
      const bossAction = this.type.generateBossAction(this.gameState, this.players);
      const result = this.type.processBossAction(this.gameState, bossAction);
  
      this.turnState = 'players';
      
      return result;
    }
  
    checkWinConditions() {
      const winCheck = this.type.checkWinCondition(this.gameState);
      const lossCheck = this.type.checkLossCondition(this.gameState);
  
      if (winCheck.hasWon) {
        this.state = 'victory';
        return { victory: true, reason: winCheck.reason };
      }
  
      if (lossCheck.hasLost) {
        this.state = 'defeat';
        return { defeat: true, reason: lossCheck.reason };
      }
  
      return { continuing: true };
    }
  
    getState() {
      return {
        id: this.id,
        state: this.state,
        turnState: this.turnState,
        players: Array.from(this.players.values()),
        playerPositions: this.playerPositions,
        bossPosition: this.geometryManager.getBossPosition(this),
        boss: this.boss,
        gameState: this.gameState,
        config: this.config
      };
    }
  }
  
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
  
  // server/raid/RaidSocketHandler.js
  // Socket.io integration with the raid engine
  
  export class RaidSocketHandler {
    constructor(io, raidEngine) {
      this.io = io;
      this.raidEngine = raidEngine;
      this.setupEventHandlers();
    }
  
    setupEventHandlers() {
      this.io.on('connection', (socket) => {
        // Raid-specific socket events
        socket.on('createRaid', this.handleCreateRaid.bind(this, socket));
        socket.on('joinRaid', this.handleJoinRaid.bind(this, socket));
        socket.on('raidAction', this.handleRaidAction.bind(this, socket));
        socket.on('leaveRaid', this.handleLeaveRaid.bind(this, socket));
        socket.on('changeLayout', this.handleChangeLayout.bind(this, socket));
      });
  
      // Listen to raid engine events
      this.raidEngine.eventBus.on('playerJoined', this.broadcastPlayerJoined.bind(this));
      this.raidEngine.eventBus.on('actionProcessed', this.broadcastActionResult.bind(this));
      this.raidEngine.eventBus.on('positionsUpdated', this.broadcastPositions.bind(this));
    }
  
    handleCreateRaid(socket, data) {
      try {
        const raid = this.raidEngine.createRaid(data.raidId, data.config);
        socket.emit('raidCreated', { 
          success: true, 
          raidId: data.raidId,
          state: raid.getState()
        });
      } catch (error) {
        socket.emit('raidCreated', { 
          success: false, 
          error: error.message 
        });
      }
    }
  
    handleJoinRaid(socket, data) {
      try {
        const success = this.raidEngine.joinRaid(data.raidId, data.playerId, data.playerData);
        
        if (success) {
          socket.join(data.raidId);
          const raid = this.raidEngine.activeRaids.get(data.raidId);
          
          socket.emit('raidJoined', { 
            success: true, 
            state: raid.getState() 
          });
        } else {
          socket.emit('raidJoined', { 
            success: false, 
            error: 'Could not join raid' 
          });
        }
      } catch (error) {
        socket.emit('raidJoined', { 
          success: false, 
          error: error.message 
        });
      }
    }
  
    handleChangeLayout(socket, data) {
      const raid = this.raidEngine.activeRaids.get(data.raidId);
      if (raid && raid.state === 'lobby') {
        raid.config.layout = data.layout; // 'circular' or 'versus'
        const positions = this.raidEngine.geometryManager.recalculatePositions(raid);
        
        this.io.to(data.raidId).emit('layoutChanged', {
          layout: data.layout,
          positions: positions
        });
      }
    }
  
    broadcastPlayerJoined(data) {
      this.io.to(data.raidId).emit('playerJoined', {
        playerId: data.playerId,
        playerCount: data.raid.players.size,
        positions: data.raid.playerPositions
      });
    }
  
    broadcastActionResult(data) {
      this.io.to(data.raidId).emit('raidActionResult', {
        playerId: data.playerId,
        action: data.action,
        result: data.result,
        newState: data.newState
      });
    }
  }