// server/raid/RaidManager.js
// Integration layer between your existing server and the raid engine

import { RaidEngine } from './core/RaidEngine.js';
import { RaidSocketHandler } from './core/RaidSocketHandler.js';

export class RaidManager {
  constructor(io, db) {
    this.io = io;
    this.db = db;
    this.raidEngine = new RaidEngine();
    this.socketHandler = new RaidSocketHandler(io, this.raidEngine);
    
    // Track raid rooms (extending your existing room system)
    this.raidRooms = new Map();
    
    this.setupDatabase();
    this.setupRaidEventHandlers();
  }

  setupDatabase() {
    // Add raid tables to your existing SQLite setup
    this.db.serialize(() => {
      // Raid instances table
      this.db.run(`CREATE TABLE IF NOT EXISTS raid_instances (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        ended_at DATETIME
      )`);

      // Raid participants table
      this.db.run(`CREATE TABLE IF NOT EXISTS raid_participants (
        raid_id TEXT,
        player_id TEXT,
        socket_id TEXT,
        username TEXT,
        position_angle REAL,
        position_x REAL,
        position_y REAL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (raid_id) REFERENCES raid_instances(id)
      )`);

      // Raid actions log (for replay/debugging)
      this.db.run(`CREATE TABLE IF NOT EXISTS raid_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raid_id TEXT,
        player_id TEXT,
        action_type TEXT,
        action_data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (raid_id) REFERENCES raid_instances(id)
      )`);
    });
  }

  setupRaidEventHandlers() {
    // Listen to your existing socket events and extend for raids
    this.io.on('connection', (socket) => {
      // Extend your existing joinGame handler
      socket.on('joinRaid', (data) => this.handleJoinRaid(socket, data));
      socket.on('createRaid', (data) => this.handleCreateRaid(socket, data));
      socket.on('raidAction', (data) => this.handleRaidAction(socket, data));
      socket.on('updateRaidLayout', (data) => this.handleUpdateLayout(socket, data));
      
      // Handle disconnection cleanup
      socket.on('disconnect', () => this.handleRaidDisconnect(socket));
    });
  }

  handleCreateRaid(socket, data) {
    const raidId = data.roomId || this.generateRaidId();
    
    const config = {
      type: data.raidType || 'tcg-official', // tcg-official, tcg-community, pokemon-go
      maxPlayers: data.maxPlayers || 4,
      minPlayers: data.minPlayers || 2,
      layout: data.layout || 'versus', // versus, circular
      ...data.config
    };

    try {
      const raid = this.raidEngine.createRaid(raidId, config);
      
      // Store in database
      this.db.run(
        'INSERT INTO raid_instances (id, type, config, state) VALUES (?, ?, ?, ?)',
        [raidId, config.type, JSON.stringify(config), 'lobby']
      );

      // Track in your existing room system
      this.raidRooms.set(raidId, {
        raidInstance: raid,
        creator: socket.id,
        createdAt: Date.now()
      });

      socket.emit('raidCreated', {
        success: true,
        raidId: raidId,
        config: config,
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
    const { raidId, username } = data;
    
    if (!this.raidRooms.has(raidId)) {
      socket.emit('raidJoinFailed', { error: 'Raid not found' });
      return;
    }

    const playerData = {
      socketId: socket.id,
      username: username,
      // Add any TCG-specific data from your existing system
      deckData: data.deckData || null
    };

    try {
      const success = this.raidEngine.joinRaid(raidId, socket.id, playerData);
      
      if (success) {
        socket.join(raidId);
        
        const raid = this.raidEngine.activeRaids.get(raidId);
        const positions = raid.playerPositions;
        
        // Store participant in database
        if (positions.length > 0) {
          const playerPos = positions.find(p => p.playerId === socket.id);
          if (playerPos) {
            this.db.run(
              'INSERT INTO raid_participants (raid_id, player_id, socket_id, username, position_angle, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [raidId, socket.id, socket.id, username, playerPos.angle, playerPos.x, playerPos.y]
            );
          }
        }

        // Broadcast to all players in raid
        this.io.to(raidId).emit('playerJoinedRaid', {
          playerId: socket.id,
          username: username,
          playerCount: raid.players.size,
          positions: positions,
          raidState: raid.getState()
        });

        socket.emit('raidJoined', {
          success: true,
          raidId: raidId,
          yourPosition: positions.find(p => p.playerId === socket.id),
          allPositions: positions,
          raidState: raid.getState()
        });
        
      } else {
        socket.emit('raidJoinFailed', { error: 'Cannot join raid (full or not in lobby)' });
      }
      
    } catch (error) {
      socket.emit('raidJoinFailed', { error: error.message });
    }
  }

  handleUpdateLayout(socket, data) {
    const { raidId, layout } = data;
    
    const raid = this.raidEngine.activeRaids.get(raidId);
    if (!raid || raid.state !== 'lobby') {
      socket.emit('layoutUpdateFailed', { error: 'Cannot change layout now' });
      return;
    }

    // Update layout and recalculate positions
    raid.config.layout = layout;
    const newPositions = this.raidEngine.geometryManager.recalculatePositions(raid);
    
    // Update database
    raid.playerPositions.forEach(pos => {
      this.db.run(
        'UPDATE raid_participants SET position_angle = ?, position_x = ?, position_y = ? WHERE raid_id = ? AND player_id = ?',
        [pos.angle, pos.x, pos.y, raidId, pos.playerId]
      );
    });

    // Broadcast new layout to all players
    this.io.to(raidId).emit('layoutUpdated', {
      layout: layout,
      positions: raid.playerPositions,
      bossPosition: this.raidEngine.geometryManager.getBossPosition(raid)
    });
  }

  handleRaidAction(socket, data) {
    const { raidId, action } = data;
    
    // Log action to database
    this.db.run(
      'INSERT INTO raid_actions (raid_id, player_id, action_type, action_data) VALUES (?, ?, ?, ?)',
      [raidId, socket.id, action.type, JSON.stringify(action)]
    );

    const result = this.raidEngine.processAction(raidId, socket.id, action);
    
    if (result.success) {
      // Broadcast action result to all players
      this.io.to(raidId).emit('raidActionResult', {
        playerId: socket.id,
        action: action,
        result: result,
        newState: this.raidEngine.activeRaids.get(raidId).getState()
      });
    } else {
      socket.emit('raidActionFailed', {
        action: action,
        error: result.error
      });
    }
  }

  handleRaidDisconnect(socket) {
    // Find and clean up any raids this socket was in
    for (const [raidId, raid] of this.raidEngine.activeRaids) {
      if (raid.players.has(socket.id)) {
        const removed = raid.removePlayer(socket.id);
        if (removed) {
          // Update database
          this.db.run(
            'DELETE FROM raid_participants WHERE raid_id = ? AND socket_id = ?',
            [raidId, socket.id]
          );
          
          // If no players left, mark raid as ended
          if (raid.players.size === 0) {
            this.db.run(
              'UPDATE raid_instances SET state = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?',
              ['abandoned', raidId]
            );
            this.raidEngine.activeRaids.delete(raidId);
            this.raidRooms.delete(raidId);
          } else {
            // Recalculate positions and notify remaining players
            const newPositions = this.raidEngine.geometryManager.recalculatePositions(raid);
            this.io.to(raidId).emit('playerLeftRaid', {
              leftPlayerId: socket.id,
              newPositions: newPositions,
              playerCount: raid.players.size
            });
          }
        }
      }
    }
  }

  generateRaidId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Method to get raid statistics (useful for debugging/monitoring)
  getRaidStats() {
    return {
      activeRaids: this.raidEngine.activeRaids.size,
      totalRooms: this.raidRooms.size,
      raidTypes: Array.from(this.raidEngine.raidTypes.keys())
    };
  }
}

// server/server.js (modification to your existing server)
// Add this to your main server file to integrate raids

// Import the new RaidManager
import { RaidManager } from './raid/RaidManager.js';

// In your main() function, after creating your Socket.IO server:
async function main() {
  // ... your existing setup ...

  // Initialize raid system
  const raidManager = new RaidManager(io, db);

  // Add raid stats endpoint
  app.get('/api/raid/stats', (req, res) => {
    res.json(raidManager.getRaidStats());
  });

  // ... rest of your server setup ...
}