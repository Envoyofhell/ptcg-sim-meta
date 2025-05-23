// server/raid-test-server.js
// Complete raid server with NO database dependencies - pure in-memory storage

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../client');

console.log('🚀 Starting PTCG Raid Test Server (In-Memory)...');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:4000"],
    credentials: true,
  },
});

app.use(cors());
app.use(express.static(clientDir));

// ===== ROUTES =====
app.get('/', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// In-memory storage (no database needed)
const gameStates = new Map(); // For your existing functionality
const raids = new Map();      // For raid system

// Your existing functionality - game state storage
app.get('/api/importData', (req, res) => {
  const key = req.query.key;
  if (!key) {
    return res.status(400).json({ error: 'Key parameter is missing' });
  }

  const data = gameStates.get(key);
  if (data) {
    res.json(JSON.parse(data));
  } else {
    res.status(404).json({ error: 'Key not found' });
  }
});

// Raid stats endpoint
app.get('/api/raid/stats', (req, res) => {
  let totalParticipants = 0;
  raids.forEach(raid => {
    if (raid.players) totalParticipants += raid.players.size;
  });

  res.json({
    activeRaids: raids.size,
    totalRaidsCreated: raids.size,
    totalParticipants: totalParticipants,
    storageType: 'in-memory',
    raidTypes: ['tcg-official', 'tcg-community']
  });
});

// ===== RAID POSITIONING SYSTEM =====
// Based on your angular clock diagram
function calculateRaidPositions(playerIds, layout = 'versus') {
  const playerCount = playerIds.length;
  let angles;
  
  if (layout === 'circular') {
    // Circular layout - players around center
    switch (playerCount) {
      case 1: angles = [0]; break;
      case 2: angles = [45, 225]; break;
      case 3: angles = [30, 150, 270]; break;
      case 4: angles = [45, 135, 225, 315]; break;
      default: 
        // Generate evenly spaced angles for more players
        angles = Array.from({length: playerCount}, (_, i) => (360 / playerCount) * i);
    }
  } else {
    // Versus layout - players on one side (your clock diagram: 15°-75°)
    switch (playerCount) {
      case 1: angles = [45]; break;
      case 2: angles = [30, 60]; break;
      case 3: angles = [15, 45, 75]; break;
      case 4: angles = [15, 35, 55, 75]; break;
      default:
        // Distribute across 15°-75° range for more players
        const start = 15, end = 75;
        const step = (end - start) / (playerCount - 1);
        angles = Array.from({length: playerCount}, (_, i) => start + (step * i));
    }
  }
  
  const radius = layout === 'versus' ? 35 : 30;
  
  return playerIds.map((id, i) => {
    const angle = angles[i] || (15 + i * 20);
    const radians = (angle * Math.PI) / 180;
    
    return {
      playerId: id,
      angle: angle,
      x: Math.max(5, Math.min(95, 50 + radius * Math.cos(radians))),
      y: Math.max(5, Math.min(95, 50 + radius * Math.sin(radians))),
      overlapFactor: calculateOverlap(angle, angles),
      fraction: ((angle + 270) % 360) / 360, // Normalize to clock position
      layout: layout,
      index: i
    };
  });
}

function calculateOverlap(currentAngle, allAngles) {
  let minDistance = 360;
  
  allAngles.forEach(angle => {
    if (angle !== currentAngle) {
      let distance = Math.abs(angle - currentAngle);
      distance = Math.min(distance, 360 - distance); // Handle wrap-around
      minDistance = Math.min(minDistance, distance);
    }
  });
  
  return Math.max(0, 1 - (minDistance / 60)); // 60° is comfortable spacing
}

function getBossPosition(layout) {
  if (layout === 'versus') {
    return { x: 50, y: 15, angle: 270 }; // Top center for versus mode
  } else {
    return { x: 50, y: 50, angle: 0 };   // Center for circular mode
  }
}

// ===== SOCKET EVENTS =====
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Your existing functionality - store game state
  socket.on('storeGameState', (exportData) => {
    const key = Math.random().toString(36).substring(2, 15);
    gameStates.set(key, exportData);
    socket.emit('exportGameStateSuccessful', key);
    console.log('💾 Game state stored with key:', key);
  });

  // ===== RAID SYSTEM =====
  socket.on('createRaid', (data) => {
    const raidId = data.roomId || 'raid-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    
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
      positions: [],
      createdAt: Date.now(),
      createdBy: socket.id
    };
    
    raids.set(raidId, raidData);
    
    socket.emit('raidCreated', { 
      success: true, 
      raidId: raidId,
      config: config
    });
    
    console.log(`🏴‍☠️ Raid created: ${raidId} (${config.type}, ${config.layout} layout)`);
  });

  socket.on('joinRaid', (data) => {
    const raid = raids.get(data.raidId);
    if (!raid) {
      socket.emit('raidJoinFailed', { error: 'Raid not found' });
      return;
    }
    
    if (raid.players.size >= raid.config.maxPlayers) {
      socket.emit('raidJoinFailed', { error: `Raid is full (${raid.config.maxPlayers} players max)` });
      return;
    }
    
    if (raid.state !== 'lobby') {
      socket.emit('raidJoinFailed', { error: 'Raid has already started' });
      return;
    }
    
    // Add player to raid
    raid.players.set(socket.id, {
      id: socket.id,
      username: data.username || 'Anonymous Player',
      deckData: data.deckData || null,
      joinedAt: Date.now()
    });
    
    // Calculate new positions for all players
    const playerIds = Array.from(raid.players.keys());
    const positions = calculateRaidPositions(playerIds, raid.config.layout);
    raid.positions = positions;
    
    socket.join(data.raidId);
    
    // Get boss position
    const bossPosition = getBossPosition(raid.config.layout);
    
    // Notify all players in the raid
    io.to(data.raidId).emit('playerJoinedRaid', {
      playerId: socket.id,
      username: data.username,
      playerCount: raid.players.size,
      maxPlayers: raid.config.maxPlayers,
      positions: positions,
      bossPosition: bossPosition,
      raidState: { 
        id: data.raidId, 
        state: raid.state,
        layout: raid.config.layout 
      }
    });
    
    // Confirm to the joining player
    socket.emit('raidJoined', {
      success: true,
      raidId: data.raidId,
      yourPosition: positions.find(p => p.playerId === socket.id),
      allPositions: positions,
      bossPosition: bossPosition,
      raidState: { 
        id: data.raidId, 
        state: raid.state,
        layout: raid.config.layout,
        playerCount: raid.players.size,
        maxPlayers: raid.config.maxPlayers
      }
    });
    
    console.log(`👋 ${data.username} joined raid ${data.raidId} (${raid.players.size}/${raid.config.maxPlayers} players)`);
  });

  socket.on('updateRaidLayout', (data) => {
    const raid = raids.get(data.raidId);
    if (!raid) {
      socket.emit('layoutUpdateFailed', { error: 'Raid not found' });
      return;
    }
    
    if (raid.state !== 'lobby') {
      socket.emit('layoutUpdateFailed', { error: 'Cannot change layout after raid starts' });
      return;
    }

    // Update layout
    raid.config.layout = data.layout;
    
    // Recalculate positions with new layout
    const playerIds = Array.from(raid.players.keys());
    const newPositions = calculateRaidPositions(playerIds, data.layout);
    raid.positions = newPositions;
    
    // Get new boss position
    const bossPosition = getBossPosition(data.layout);
    
    // Broadcast layout update to all players
    io.to(data.raidId).emit('layoutUpdated', {
      layout: data.layout,
      positions: newPositions,
      bossPosition: bossPosition
    });
    
    console.log(`🔄 Layout changed to "${data.layout}" for raid ${data.raidId}`);
  });

  socket.on('raidAction', (data) => {
    const raid = raids.get(data.raidId);
    if (!raid) {
      socket.emit('raidActionFailed', { error: 'Raid not found' });
      return;
    }
    
    // Simple action handling (expand this for actual game logic)
    console.log(`🎮 Raid action in ${data.raidId}:`, data.action);
    
    // Broadcast action to all players
    io.to(data.raidId).emit('raidActionResult', {
      playerId: socket.id,
      action: data.action,
      result: { success: true, message: 'Action processed' }
    });
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    
    // Clean up raids
    for (const [raidId, raid] of raids) {
      if (raid.players && raid.players.has(socket.id)) {
        const player = raid.players.get(socket.id);
        raid.players.delete(socket.id);
        
        if (raid.players.size === 0) {
          // Delete empty raid
          raids.delete(raidId);
          console.log(`🗑️ Empty raid ${raidId} deleted`);
        } else {
          // Recalculate positions for remaining players
          const playerIds = Array.from(raid.players.keys());
          const newPositions = calculateRaidPositions(playerIds, raid.config.layout);
          raid.positions = newPositions;
          
          // Notify remaining players
          io.to(raidId).emit('playerLeftRaid', {
            leftPlayerId: socket.id,
            leftPlayerName: player?.username || 'Unknown',
            newPositions: newPositions,
            playerCount: raid.players.size
          });
          
          console.log(`👋 Player left raid ${raidId} (${raid.players.size} remaining)`);
        }
      }
    }
  });
});

// ===== START SERVER =====
const port = 4000;
server.listen(port, () => {
  console.log('');
  console.log('🚀 PTCG Raid Test Server Started!');
  console.log(`🌐 Server: http://localhost:${port}`);
  console.log(`📊 Stats: http://localhost:${port}/api/raid/stats`);
  console.log(`💾 Storage: In-Memory (no database dependencies)`);
  console.log('🎮 Ready for raid battles!');
  console.log('');
  console.log('📝 Features:');
  console.log('  ✅ Angular positioning based on your clock diagram');
  console.log('  ✅ Versus layout: 15°-75° player positioning');
  console.log('  ✅ Circular layout: 360° distributed positioning');
  console.log('  ✅ Real-time multiplayer (2-4 players)');
  console.log('  ✅ Layout switching in lobby');
  console.log('  ✅ Automatic position recalculation');
  console.log('  ✅ Boss positioning (top for versus, center for circular)');
  console.log('');
});

// Cleanup function for graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down raid server...');
  console.log(`📈 Final stats: ${raids.size} active raids`);
  process.exit(0);
});