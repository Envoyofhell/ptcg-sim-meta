// ===================================================================
// File: server/raid/core/EnhancedRaidSocketHandler.js
// Path: /server/raid/core/EnhancedRaidSocketHandler.js
// Location: Enhanced socket integration for raid game mechanics
// Changes: Integration with TCGOfficialActionHandler and RaidGameUI
// Dependencies: RaidEngine.js, ../types/TCGOfficialActionHandler.js
// Dependents: RaidManager.js, client RaidGameUI.js
// Changelog: 
//   v1.0.0 - Enhanced socket handling with game action integration
//   v1.0.1 - Added automatic event broadcasting and error handling
//   v1.0.2 - Added spectator mode and turn management events
// Version: 1.0.2
// ===================================================================

import { TCGOfficialActionHandler } from '../types/TCGOfficialActionHandler.js';

export class EnhancedRaidSocketHandler {
  constructor(io, raidEngine) {
    this.io = io;
    this.raidEngine = raidEngine;
    this.actionHandlers = new Map(); // raidId -> actionHandler
    this.eventBroadcastInterval = null;
    
    this.setupEventHandlers();
    this.startEventBroadcasting();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Raid client connected: ${socket.id}`);
      
      // Core raid events
      socket.on('createRaid', (data) => this.handleCreateRaid(socket, data));
      socket.on('joinRaid', (data) => this.handleJoinRaid(socket, data));
      socket.on('raidAction', (data) => this.handleRaidAction(socket, data));
      socket.on('leaveRaid', (data) => this.handleLeaveRaid(socket, data));
      
      // Game-specific events
      socket.on('requestGameState', (data) => this.handleRequestGameState(socket, data));
      socket.on('requestTurnInfo', (data) => this.handleRequestTurnInfo(socket, data));
      socket.on('spectatorAction', (data) => this.handleSpectatorAction(socket, data));
      
      // Layout and positioning
      socket.on('changeLayout', (data) => this.handleChangeLayout(socket, data));
      
      // Disconnect handling
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  // ================ RAID LIFECYCLE ================

  async handleCreateRaid(socket, data) {
    try {
      const raidConfig = {
        type: data.raidType || 'tcg-official',
        maxPlayers: data.maxPlayers || 4,
        minPlayers: data.minPlayers || 2,
        layout: data.layout || 'versus',
        bossCard: data.bossCard || null,
        ...data.config
      };

      const raid = this.raidEngine.createRaid(data.raidId, raidConfig);
      
      // Create action handler for this raid
      if (raidConfig.type === 'tcg-official') {
        this.actionHandlers.set(data.raidId, new TCGOfficialActionHandler(raid.gameState));
      }

      socket.emit('raidCreated', { 
        success: true, 
        raidId: data.raidId,
        config: raidConfig,
        state: raid.getState()
      });

      console.log(`🏴‍☠️ Raid created: ${data.raidId} (${raidConfig.type})`);

    } catch (error) {
      console.error('Error creating raid:', error);
      socket.emit('raidCreated', { 
        success: false, 
        error: error.message 
      });
    }
  }

  async handleJoinRaid(socket, data) {
    try {
      const raid = this.raidEngine.activeRaids.get(data.raidId);
      if (!raid) {
        socket.emit('raidJoinFailed', { error: 'Raid not found' });
        return;
      }

      const playerData = {
        socketId: socket.id,
        username: data.username,
        deckData: data.deckData || null,
        pokemon: data.pokemon || this.generateDefaultPokemon()
      };

      const success = this.raidEngine.joinRaid(data.raidId, socket.id, playerData);
      
      if (success) {
        socket.join(data.raidId);
        
        const raidState = raid.getState();
        const positions = raid.playerPositions;
        const bossPosition = this.raidEngine.geometryManager.getBossPosition(raid);

        // Initialize game state if first player and TCG Official
        if (raid.config.type === 'tcg-official' && raid.players.size === 1) {
          await this.initializeGameState(data.raidId, raid);
        }

        // Notify all players
        this.io.to(data.raidId).emit('playerJoinedRaid', {
          playerId: socket.id,
          username: data.username,
          playerCount: raid.players.size,
          maxPlayers: raid.config.maxPlayers,
          positions: positions,
          bossPosition: bossPosition,
          raidState: raidState
        });

        // Send full state to joining player
        socket.emit('raidJoined', {
          success: true,
          raidId: data.raidId,
          yourPosition: positions.find(p => p.playerId === socket.id),
          allPositions: positions,
          bossPosition: bossPosition,
          raidState: raidState,
          gameState: raid.gameState ? raid.gameState.getGameState() : null
        });

        console.log(`👋 ${data.username} joined raid ${data.raidId}`);

      } else {
        socket.emit('raidJoinFailed', { error: 'Cannot join raid' });
      }

    } catch (error) {
      console.error('Error joining raid:', error);
      socket.emit('raidJoinFailed', { error: error.message });
    }
  }

  // ================ GAME ACTIONS ================

  async handleRaidAction(socket, data) {
    try {
      const { raidId, action } = data;
      const actionHandler = this.actionHandlers.get(raidId);
      const raid = this.raidEngine.activeRaids.get(raidId);
      
      if (!actionHandler || !raid) {
        socket.emit('raidActionFailed', { 
          action: action,
          error: 'Raid or action handler not found' 
        });
        return;
      }

      console.log(`🎮 Processing action in ${raidId}:`, action.type);

      // Process action through handler
      const result = await actionHandler.processAction(socket.id, action);
      
      if (result.success) {
        // Broadcast result to all players in raid
        this.io.to(raidId).emit('raidActionResult', {
          playerId: socket.id,
          action: action,
          result: result,
          newState: raid.gameState ? raid.gameState.getGameState() : null,
          timestamp: Date.now()
        });

        // Handle special results
        if (result.isSpectator) {
          socket.emit('spectatorModeChanged', { 
            isSpectator: true,
            spectatorInfo: result.spectatorInfo 
          });
        }

      } else {
        socket.emit('raidActionFailed', {
          action: action,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Error processing raid action:', error);
      socket.emit('raidActionFailed', {
        action: data.action,
        error: 'Server error processing action'
      });
    }
  }

  // ================ GAME STATE MANAGEMENT ================

  async handleRequestGameState(socket, data) {
    const raid = this.raidEngine.activeRaids.get(data.raidId);
    if (!raid || !raid.gameState) {
      socket.emit('gameStateResponse', { error: 'Game state not found' });
      return;
    }

    socket.emit('gameStateResponse', {
      success: true,
      gameState: raid.gameState.getGameState(),
      raidState: raid.getState()
    });
  }

  async handleRequestTurnInfo(socket, data) {
    const raid = this.raidEngine.activeRaids.get(data?.raidId);
    if (!raid || !raid.gameState || !raid.gameState.turnManager) {
      return;
    }

    const turnInfo = raid.gameState.turnManager.getCurrentTurnInfo();
    socket.emit('turnEvent', {
      turnIndicator: turnInfo.indicator,
      turnInfo: turnInfo,
      timestamp: Date.now()
    });
  }

  async handleSpectatorAction(socket, data) {
    const { raidId, action } = data;
    const raid = this.raidEngine.activeRaids.get(raidId);
    
    if (!raid || !raid.gameState || !raid.gameState.spectatorManager) {
      socket.emit('spectatorActionFailed', { error: 'Spectator system not available' });
      return;
    }

    let result;
    switch (action.type) {
      case 'chat':
        result = raid.gameState.spectatorManager.processSpectatorChat(socket.id, action.message);
        break;
      case 'suggestion':
        result = raid.gameState.spectatorManager.processSpectatorSuggestion(socket.id, action.suggestion);
        break;
      default:
        result = { success: false, error: 'Unknown spectator action' };
    }

    if (result.success) {
      socket.emit('spectatorActionResult', result);
    } else {
      socket.emit('spectatorActionFailed', result);
    }
  }

  // ================ INITIALIZATION ================

  async initializeGameState(raidId, raid) {
    try {
      // Import game state class dynamically based on raid type
      if (raid.config.type === 'tcg-official') {
        const { TCGOfficialGameState } = await import('../types/TCGOfficialGameState.js');
        raid.gameState = new TCGOfficialGameState(raid.config, raid.players);
        raid.gameState.gamePhase = 'playing';
        
        console.log(`🎮 Initialized TCG Official game state for raid ${raidId}`);
      }
    } catch (error) {
      console.error('Error initializing game state:', error);
    }
  }

  generateDefaultPokemon() {
    return {
      active: {
        name: 'Pikachu',
        hp: 120,
        maxHP: 120,
        attacks: [
          { name: 'Thunder Shock', damage: 60 },
          { name: 'Agility', damage: 40 }
        ]
      },
      bench: {
        name: 'Squirtle', 
        hp: 100,
        maxHP: 100,
        attacks: [
          { name: 'Water Gun', damage: 50 },
          { name: 'Tackle', damage: 30 }
        ]
      }
    };
  }

  // ================ EVENT BROADCASTING ================

  startEventBroadcasting() {
    // Broadcast queued events every 100ms
    this.eventBroadcastInterval = setInterval(() => {
      this.processEventQueues();
    }, 100);
  }

  processEventQueues() {
    this.raidEngine.activeRaids.forEach((raid, raidId) => {
      if (!raid.gameState || !raid.gameState.eventQueue) return;

      const events = raid.gameState.eventQueue;
      raid.gameState.eventQueue = [];

      events.forEach(event => {
        if (event.spectatorId) {
          // Send to specific spectator
          this.io.to(raidId).emit(event.type, event);
        } else {
          // Broadcast to all players in raid
          this.io.to(raidId).emit(event.type, event.data || event);
        }
      });
    });
  }

  // ================ LAYOUT MANAGEMENT ================

  async handleChangeLayout(socket, data) {
    const { raidId, layout } = data;
    const raid = this.raidEngine.activeRaids.get(raidId);
    
    if (!raid || raid.state !== 'lobby') {
      socket.emit('layoutUpdateFailed', { error: 'Cannot change layout now' });
      return;
    }

    raid.config.layout = layout;
    const newPositions = this.raidEngine.geometryManager.recalculatePositions(raid);
    const bossPosition = this.raidEngine.geometryManager.getBossPosition(raid);

    this.io.to(raidId).emit('layoutUpdated', {
      layout: layout,
      positions: raid.playerPositions,
      bossPosition: bossPosition
    });

    console.log(`🔄 Layout updated to ${layout} for raid ${raidId}`);
  }

  // ================ CLEANUP ================

  handleDisconnect(socket) {
    console.log(`🔌 Raid client disconnected: ${socket.id}`);
    
    // Find and clean up any raids this socket was in
    for (const [raidId, raid] of this.raidEngine.activeRaids) {
      if (raid.players && raid.players.has(socket.id)) {
        const player = raid.players.get(socket.id);
        raid.removePlayer(socket.id);
        
        if (raid.players.size === 0) {
          // Clean up empty raid
          this.raidEngine.activeRaids.delete(raidId);
          this.actionHandlers.delete(raidId);
          console.log(`🗑️ Cleaned up empty raid ${raidId}`);
        } else {
          // Notify remaining players
          const newPositions = this.raidEngine.geometryManager.recalculatePositions(raid);
          this.io.to(raidId).emit('playerLeftRaid', {
            leftPlayerId: socket.id,
            leftPlayerName: player?.username || 'Unknown',
            newPositions: newPositions,
            playerCount: raid.players.size
          });
          
          console.log(`👋 Player left raid ${raidId} (${raid.players.size} remaining)`);
        }
      }
    }
  }

  handleLeaveRaid(socket, data) {
    // Intentional leave - same cleanup as disconnect but triggered by user
    this.handleDisconnect(socket);
    socket.emit('raidLeft', { success: true });
  }

  // ================ SHUTDOWN ================

  shutdown() {
    if (this.eventBroadcastInterval) {
      clearInterval(this.eventBroadcastInterval);
    }
    
    // Clean up all action handlers
    this.actionHandlers.clear();
    
    console.log('🛑 Enhanced Raid Socket Handler shut down');
  }
}