// server/working-server.js
// Complete working server with local SQLite database

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../client');

console.log('🚀 Starting PTCG Raid Server...');

// ===== DATABASE SETUP =====
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('📁 Created database directory');
}

const dbPath = path.join(dbDir, 'raid-game.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize database tables
db.exec(`
  -- Original tables for your existing functionality
  CREATE TABLE IF NOT EXISTS KeyValuePairs (
    key TEXT PRIMARY KEY, 
    value TEXT
  );

  -- Raid system tables
  CREATE TABLE IF NOT EXISTS raid_instances (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    config TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    ended_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS raid_participants (
    raid_id TEXT,
    player_id TEXT,
    socket_id TEXT,
    username TEXT,
    position_angle REAL,
    position_x REAL,
    position_y REAL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (raid_id) REFERENCES raid_instances(id)
  );

  CREATE TABLE IF NOT EXISTS raid_actions (
    id INTEGER PRIMARY KEY,
    raid_id TEXT,
    player_id TEXT,
    action_type TEXT,
    action_data TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (raid_id) REFERENCES raid_instances(id)
  );
`);

console.log('✅ Database initialized at:', dbPath);

// ===== EXPRESS SETUP =====
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  connectionStateRecovery: {},
  cors: {
    origin: [
      'https://admin.socket.io',
      'https://ptcg-sim-meta.pages.dev',
      'http://localhost:3000',
      'https://meta-ptcg.org',
      'https://test.meta-ptcg.org',
      'http://localhost:4000'
    ],
    credentials: true,
  },
});

app.use(cors());
app.use(express.static(clientDir));

// ===== ROUTES =====
app.get('/', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

app.get('/import', (req, res) => {
  const key = req.query.key;
  if (!key) {
    return res.status(400).json({ error: 'Key parameter is missing' });
  }
  res.sendFile(path.join(clientDir, 'import.html'));
});

app.get('/api/importData', (req, res) => {
  const key = req.query.key;
  if (!key) {
    return res.status(400).json({ error: 'Key parameter is missing' });
  }

  try {
    const stmt = db.prepare('SELECT value FROM KeyValuePairs WHERE key = ?');
    const row = stmt.get(key);
    
    if (row) {
      const jsonData = JSON.parse(row.value);
      res.json(jsonData);
    } else {
      res.status(404).json({ error: 'Key not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Raid stats endpoint
app.get('/api/raid/stats', (req, res) => {
  try {
    const raidCount = db.prepare('SELECT COUNT(*) as count FROM raid_instances').get();
    const participantCount = db.prepare('SELECT COUNT(*) as count FROM raid_participants').get();
    
    res.json({
      activeRaids: raids.size,
      totalRaidsCreated: raidCount.count,
      totalParticipants: participantCount.count,
      databasePath: dbPath,
      raidTypes: ['tcg-official', 'tcg-community']
    });
  } catch (err) {
    res.json({ 
      error: err.message,
      activeRaids: raids.size,
      raidTypes: ['tcg-official']
    });
  }
});

// ===== RAID SYSTEM =====
const raids = new Map();

function calculateRaidPositions(playerIds, layout = 'versus') {
  const playerCount = playerIds.length;
  let angles;
  
  if (layout === 'circular') {
    // Circular layout - players around center
    angles = playerCount === 2 ? [45, 225] :
             playerCount === 3 ? [30, 150, 270] :
             [45, 135, 225, 315];
  } else {
    // Versus layout - players on one side (your clock diagram)
    angles = playerCount === 1 ? [45] :
             playerCount === 2 ? [30, 60] :
             playerCount === 3 ? [15, 45, 75] :
             [15, 35, 55, 75];
  }
  
  const radius = 35;
  
  return playerIds.map((id, i) => ({
    playerId: id,
    angle: angles[i] || (15 + i * 20),
    x: 50 + radius * Math.cos((angles[i] || 45) * Math.PI / 180),
    y: 50 + radius * Math.sin((angles[i] || 45) * Math.PI / 180),
    overlapFactor: 0,
    fraction: (angles[i] || 45) / 360,
    layout: layout
  }));
}

// ===== SOCKET EVENTS =====
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Original functionality
  socket.on('storeGameState', (exportData) => {
    const key = Math.random().toString(36).substring(2, 15);
    
    try {
      const stmt = db.prepare('INSERT OR REPLACE INTO KeyValuePairs (key, value) VALUES (?, ?)');
      stmt.run(key, exportData);
      socket.emit('exportGameStateSuccessful', key);
    } catch (err) {
      socket.emit('exportGameStateFailed', 'Error exporting game: ' + err.message);
    }
  });

  // Raid functionality
  socket.on('createRaid', (data) => {
    const raidId = data.roomId || 'raid-' + Date.now();
    const config = {
      type: data.raidType || 'tcg-official',
      maxPlayers: data.maxPlayers || 4,
      minPlayers: data.minPlayers || 2,
      layout: data.layout || 'versus',
      ...data
    };
    
    const raidData = {
      id: raidId,
      config: config,
      state: 'lobby',
      players: new Map(),
      positions: []
    };
    
    raids.set(raidId, raidData);
    
    // Store in database
    try {
      const stmt = db.prepare('INSERT INTO raid_instances (id, type, config, state) VALUES (?, ?, ?, ?)');
      stmt.run(raidId, config.type, JSON.stringify(config), 'lobby');
      console.log('📝 Raid created and saved:', raidId);
    } catch (err) {
      console.error('❌ Database error:', err);
    }
    
    socket.emit('raidCreated', { 
      success: true, 
      raidId: raidId,
      config: config
    });
  });

  socket.on('joinRaid', (data) => {
    const raid = raids.get(data.raidId);
    if (!raid) {
      socket.emit('raidJoinFailed', { error: 'Raid not found' });
      return;
    }
    
    if (raid.players.size >= raid.config.maxPlayers) {
      socket.emit('raidJoinFailed', { error: 'Raid is full' });
      return;
    }
    
    raid.players.set(socket.id, {
      id: socket.id,
      username: data.username,
      deckData: data.deckData
    });
    
    // Calculate positions
    const playerIds = Array.from(raid.players.keys());
    const positions = calculateRaidPositions(playerIds, raid.config.layout);
    raid.positions = positions;
    
    // Store participant in database
    try {
      const stmt = db.prepare('INSERT INTO raid_participants (raid_id, player_id, socket_id, username, position_angle, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const playerPos = positions.find(p => p.playerId === socket.id);
      if (playerPos) {
        stmt.run(data.raidId, socket.id, socket.id, data.username, playerPos.angle, playerPos.x, playerPos.y);
      }
    } catch (err) {
      console.error('❌ Database error:', err);
    }
    
    socket.join(data.raidId);
    
    // Notify all players
    io.to(data.raidId).emit('playerJoinedRaid', {
      playerId: socket.id,
      username: data.username,
      playerCount: raid.players.size,
      positions: positions,
      raidState: { id: data.raidId, state: raid.state }
    });
    
    // Confirm to joining player
    socket.emit('raidJoined', {
      success: true,
      raidId: data.raidId,
      yourPosition: positions.find(p => p.playerId === socket.id),
      allPositions: positions,
      raidState: { id: data.raidId, state: raid.state }
    });
    
    console.log(`👋 ${data.username} joined raid ${data.raidId} (${raid.players.size}/${raid.config.maxPlayers} players)`);
  });

  socket.on('updateRaidLayout', (data) => {
    const raid = raids.get(data.raidId);
    if (!raid || raid.state !== 'lobby') {
      socket.emit('layoutUpdateFailed', { error: 'Cannot change layout now' });
      return;
    }

    raid.config.layout = data.layout;
    const playerIds = Array.from(raid.players.keys());
    const newPositions = calculateRaidPositions(playerIds, data.layout);
    raid.positions = newPositions;
    
    // Update database
    try {
      newPositions.forEach(pos => {
        const stmt = db.prepare('UPDATE raid_participants SET position_angle = ?, position_x = ?, position_y = ? WHERE raid_id = ? AND player_id = ?');
        stmt.run(pos.angle, pos.x, pos.y, data.raidId, pos.playerId);
      });
    } catch (err) {
      console.error('❌ Database error:', err);
    }

    // Calculate boss position
    const bossPosition = data.layout === 'versus' 
      ? { x: 50, y: 20, angle: 270 } // Top for versus
      : { x: 50, y: 50, angle: 0 };  // Center for circular

    // Broadcast new layout
    io.to(data.raidId).emit('layoutUpdated', {
      layout: data.layout,
      positions: newPositions,
      bossPosition: bossPosition
    });
    
    console.log(`🔄 Layout changed to ${data.layout} for raid ${data.raidId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    
    // Clean up raids
    for (const [raidId, raid] of raids) {
      if (raid.players && raid.players.has(socket.id)) {
        raid.players.delete(socket.id);
        
        if (raid.players.size === 0) {
          raids.delete(raidId);
          console.log(`🗑️ Empty raid ${raidId} deleted`);
        } else {
          // Recalculate positions
          const playerIds = Array.from(raid.players.keys());
          const newPositions = calculateRaidPositions(playerIds, raid.config.layout);
          raid.positions = newPositions;
          
          io.to(raidId).emit('playerLeftRaid', {
            leftPlayerId: socket.id,
            newPositions: newPositions,
            playerCount: raid.players.size
          });
        }
      }
    }
  });
});

// ===== START SERVER =====
const port = 4000;
server.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
  console.log(`💾 Database: ${dbPath}`);
  console.log(`📊 Stats: http://localhost:${port}/api/raid/stats`);
  console.log(`🎮 Ready for raid battles!`);
});

// ===== INSTRUCTIONS =====
/*
TO USE THIS SERVER:

1. Save this as server/working-server.js
2. Install dependencies:
   npm install better-sqlite3
3. Run the server:
   node working-server.js
4. Add the test button to your client/index.html
5. Test raid creation and multiplayer positioning

This server includes:
✅ Local SQLite database with all tables
✅ Your original functionality (game state storage)
✅ Full raid system with angular positioning
✅ Database persistence for raids and participants
✅ Real-time multiplayer with position calculations
✅ Layout switching between versus and circular modes

Database will be created at: server/database/raid-game.sqlite
*/
