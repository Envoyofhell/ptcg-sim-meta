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