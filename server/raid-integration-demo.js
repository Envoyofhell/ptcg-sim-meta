// ===================================================================
// File: server/raid-integration-demo.js
// Path: /server/raid-integration-demo.js
// Location: Complete integration demo for enhanced raid system
// Changes: Full integration of all raid components with testing
// Dependencies: ./raid/core/EnhancedRaidSocketHandler.js, ./raid/types/TCGOfficialActionHandler.js
// Dependents: client/src/raid/EnhancedRaidClient.js
// Changelog: 
//   v1.0.0 - Complete integration demo with all components
//   v1.0.1 - Added comprehensive testing and monitoring
//   v1.0.2 - Added performance metrics and debugging tools
// Version: 1.0.2
// ===================================================================

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Import your enhanced raid system
import { RaidEngine } from './raid/core/RaidEngine.js';
import { EnhancedRaidSocketHandler } from './raid/core/EnhancedRaidSocketHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../client');

console.log('🚀 Starting Enhanced PTCG Raid Integration Demo...');

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
  res.sendFile(path.join(clientDir, 'raid-test.html'));
});

app.get('/demo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enhanced Raid System Demo</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: white;
            }
            .demo-container {
                max-width: 800px;
                margin: 0 auto;
                background: rgba(0,0,0,0.1);
                padding: 30px;
                border-radius: 15px;
                backdrop-filter: blur(10px);
            }
            .demo-button {
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
                border: none;
                padding: 15px 25px;
                margin: 10px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: bold;
                transition: all 0.3s ease;
            }
            .demo-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }
            .status-log {
                background: rgba(0,0,0,0.3);
                padding: 20px;
                border-radius: 10px;
                margin-top: 20px;
                height: 400px;
                overflow-y: auto;
                font-family: monospace;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="demo-container">
            <h1>🏴‍☠️ Enhanced Raid System Demo</h1>
            <p>Complete integration of TCG Official raid mechanics with turn management, spectator mode, and boss AI.</p>
            
            <div class="demo-controls">
                <button class="demo-button" onclick="runBasicDemo()">🎮 Basic Game Demo</button>
                <button class="demo-button" onclick="runMultiplayerDemo()">👥 Multiplayer Demo</button>
                <button class="demo-button" onclick="runSpectatorDemo()">👁️ Spectator Demo</button>
                <button class="demo-button" onclick="runStressTest()">⚡ Stress Test</button>
                <button class="demo-button" onclick="clearLog()">🗑️ Clear Log</button>
            </div>
            
            <div class="status-log" id="statusLog">
                Demo system ready. Click a button above to start testing.<br>
                <br>
                Features demonstrated:<br>
                ✅ Turn-based gameplay with dynamic indicators<br>
                ✅ Boss AI with threat assessment<br>
                ✅ Spectator mode with automatic conversion<br>
                ✅ Real-time multiplayer synchronization<br>
                ✅ Complete error handling and validation<br>
                ✅ Angular positioning system<br>
                ✅ Cheer card mechanics<br>
                ✅ KO tracking and win/loss conditions<br>
            </div>
        </div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
            const socket = io();
            let raidClient = null;
            
            // Import the enhanced client (in real implementation)
            // For demo, we'll simulate the client functionality
            
            function log(message) {
                const statusLog = document.getElementById('statusLog');
                const timestamp = new Date().toLocaleTimeString();
                statusLog.innerHTML += \`[<span style="color: #00ff00">\${timestamp}</span>] \${message}<br>\`;
                statusLog.scrollTop = statusLog.scrollHeight;
            }
            
            async function runBasicDemo() {
                log('🎮 Starting Basic Game Demo...');
                
                try {
                    // Create a raid
                    socket.emit('createRaid', {
                        raidId: 'demo-basic-' + Date.now(),
                        raidType: 'tcg-official',
                        maxPlayers: 4,
                        layout: 'versus'
                    });
                    
                    socket.once('raidCreated', async (data) => {
                        if (data.success) {
                            log(\`✅ Raid created: \${data.raidId}\`);
                            
                            // Join the raid
                            socket.emit('joinRaid', {
                                raidId: data.raidId,
                                username: 'Demo Player',
                                pokemon: {
                                    active: { name: 'Pikachu', hp: 120, maxHP: 120, attacks: [{ name: 'Thunder Shock', damage: 60 }] },
                                    bench: { name: 'Squirtle', hp: 100, maxHP: 100, attacks: [{ name: 'Water Gun', damage: 50 }] }
                                }
                            });
                        }
                    });
                    
                    socket.once('raidJoined', async (data) => {
                        if (data.success) {
                            log(\`✅ Joined raid successfully\`);
                            log(\`🎯 Your position: \${Math.round(data.yourPosition.angle)}°\`);
                            
                            // Simulate gameplay
                            setTimeout(() => {
                                log('⚔️ Attacking boss...');
                                socket.emit('raidAction', {
                                    raidId: data.raidId,
                                    action: { type: 'playerAttack', pokemon: 'active', attackName: 'Thunder Shock', damage: 60 }
                                });
                            }, 2000);
                        }
                    });
                    
                    socket.on('raidActionResult', (data) => {
                        if (data.action.type === 'playerAttack') {
                            log(\`💥 Attack hit! Boss HP: \${data.result.newBossHP}\`);
                            
                            // Test retreat
                            setTimeout(() => {
                                log('🔄 Testing retreat...');
                                socket.emit('raidAction', {
                                    raidId: data.raidId || 'current-raid',
                                    action: { type: 'playerRetreat' }
                                });
                            }, 2000);
                        } else if (data.action.type === 'playerRetreat') {
                            log(\`🔄 Retreat successful! New active: \${data.result.newActive}\`);
                        }
                    });
                    
                } catch (error) {
                    log(\`❌ Demo failed: \${error.message}\`);
                }
            }
            
            async function runMultiplayerDemo() {
                log('👥 Starting Multiplayer Demo...');
                log('📝 This simulates multiple players joining and taking turns');
                
                const raidId = 'demo-multiplayer-' + Date.now();
                
                // Create raid
                socket.emit('createRaid', {
                    raidId: raidId,
                    raidType: 'tcg-official',
                    maxPlayers: 4,
                    layout: 'circular'
                });
                
                socket.once('raidCreated', (data) => {
                    if (data.success) {
                        log(\`✅ Multiplayer raid created: \${raidId}\`);
                        
                        // Simulate multiple players joining
                        const players = ['Alice', 'Bob', 'Charlie', 'Diana'];
                        players.forEach((name, index) => {
                            setTimeout(() => {
                                log(\`👤 \${name} joining...\`);
                                socket.emit('joinRaid', {
                                    raidId: raidId,
                                    username: name,
                                    pokemon: {
                                        active: { name: \`Pokemon-\${index + 1}\`, hp: 120, maxHP: 120, attacks: [{ name: 'Attack', damage: 50 + index * 10 }] },
                                        bench: { name: \`Bench-\${index + 1}\`, hp: 100, maxHP: 100, attacks: [{ name: 'Quick Attack', damage: 30 + index * 5 }] }
                                    }
                                });
                            }, index * 1000);
                        });
                    }
                });
                
                socket.on('playerJoinedRaid', (data) => {
                    log(\`👋 \${data.username} joined! Players: \${data.playerCount}/\${data.maxPlayers}\`);
                    if (data.playerCount === 4) {
                        log('🎉 All players joined! Ready for battle!');
                    }
                });
            }
            
            async function runSpectatorDemo() {
                log('👁️ Starting Spectator Demo...');
                log('📝 This demonstrates spectator mode and automatic conversion');
                
                const raidId = 'demo-spectator-' + Date.now();
                
                socket.emit('createRaid', {
                    raidId: raidId,
                    raidType: 'tcg-official',
                    maxPlayers: 2,
                    layout: 'versus'
                });
                
                socket.once('raidCreated', (data) => {
                    if (data.success) {
                        log(\`✅ Spectator demo raid created\`);
                        
                        // Join as player first
                        socket.emit('joinRaid', {
                            raidId: raidId,
                            username: 'Demo Player',
                            pokemon: {
                                active: { name: 'Pikachu', hp: 120, maxHP: 120, attacks: [{ name: 'Thunder', damage: 80 }] },
                                bench: { name: 'Raichu', hp: 140, maxHP: 140, attacks: [{ name: 'Thunder Wave', damage: 70 }] }
                            }
                        });
                    }
                });
                
                socket.once('raidJoined', (data) => {
                    log('✅ Joined as player');
                    
                    // Test KO to become spectator
                    setTimeout(() => {
                        log('💀 Testing KO to become spectator...');
                        socket.emit('raidAction', {
                            raidId: data.raidId,
                            action: { type: 'testKO', pokemon: 'active' }
                        });
                    }, 2000);
                    
                    setTimeout(() => {
                        log('👁️ Converting to spectator...');
                        socket.emit('raidAction', {
                            raidId: data.raidId,
                            action: { type: 'joinAsSpectator' }
                        });
                    }, 4000);
                });
                
                socket.on('spectatorModeChanged', (data) => {
                    if (data.isSpectator) {
                        log('👁️ Now in spectator mode!');
                        
                        // Test spectator chat
                        setTimeout(() => {
                            socket.emit('raidAction', {
                                raidId: 'current-raid',
                                action: { type: 'spectatorChat', message: 'Hello from spectator!' }
                            });
                        }, 1000);
                    }
                });
            }
            
            async function runStressTest() {
                log('⚡ Starting Stress Test...');
                log('📝 This tests rapid actions and edge cases');
                
                const raidId = 'demo-stress-' + Date.now();
                
                socket.emit('createRaid', {
                    raidId: raidId,
                    raidType: 'tcg-official',
                    maxPlayers: 4,
                    layout: 'versus'
                });
                
                socket.once('raidCreated', (data) => {
                    socket.emit('joinRaid', {
                        raidId: raidId,
                        username: 'Stress Tester',
                        pokemon: {
                            active: { name: 'Stress Pokemon', hp: 200, maxHP: 200, attacks: [{ name: 'Rapid Fire', damage: 25 }] },
                            bench: { name: 'Backup', hp: 150, maxHP: 150, attacks: [{ name: 'Support', damage: 15 }] }
                        }
                    });
                });
                
                socket.once('raidJoined', (data) => {
                    log('✅ Stress test raid joined');
                    
                    // Rapid fire actions
                    let actionCount = 0;
                    const maxActions = 10;
                    
                    const performAction = () => {
                        if (actionCount >= maxActions) {
                            log(\`⚡ Stress test completed! \${maxActions} actions performed\`);
                            return;
                        }
                        
                        const actions = [
                            { type: 'playerAttack', pokemon: 'active', attackName: 'Rapid Fire', damage: 25 },
                            { type: 'playerRetreat' },
                            { type: 'playerAttack', pokemon: 'bench', attackName: 'Support', damage: 15 }
                        ];
                        
                        const action = actions[actionCount % actions.length];
                        
                        socket.emit('raidAction', {
                            raidId: data.raidId,
                            action: action
                        });
                        
                        actionCount++;
                        log(\`⚡ Action \${actionCount}: \${action.type}\`);
                        
                        setTimeout(performAction, 500);
                    };
                    
                    setTimeout(performAction, 1000);
                });
                
                socket.on('raidActionResult', (data) => {
                    if (data.action.type === 'playerAttack') {
                        log(\`💥 Hit! Boss HP: \${data.result.newBossHP}\`);
                    }
                });
            }
            
            function clearLog() {
                document.getElementById('statusLog').innerHTML = 'Log cleared.<br>';
            }
            
            // Global error handling
            socket.on('raidActionFailed', (data) => {
                log(\`❌ Action failed: \${data.error}\`);
            });
            
            socket.on('gameEnded', (data) => {
                const result = data.victory ? '🎉 VICTORY!' : '💀 DEFEAT!';
                log(\`\${result} \${data.reason}\`);
            });
            
            socket.on('bossActionsCompleted', (data) => {
                log(\`👹 Boss performed \${data.attacks.length} attacks\`);
            });
            
            socket.on('connect', () => {
                log('🔌 Connected to enhanced raid server');
            });
            
            socket.on('disconnect', () => {
                log('🔌 Disconnected from server');
            });
        </script>
    </body>
    </html>
  `);
});

// Performance monitoring endpoint
app.get('/api/raid/stats', (req, res) => {
  const stats = {
    activeRaids: raidEngine.activeRaids.size,
    totalHandlers: socketHandler.actionHandlers.size,
    serverUptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    timestamp: Date.now()
  };
  
  res.json(stats);
});

// ===== ENHANCED RAID SYSTEM INITIALIZATION =====
const raidEngine = new RaidEngine();
const socketHandler = new EnhancedRaidSocketHandler(io, raidEngine);

// Server monitoring
setInterval(() => {
  const activeRaids = raidEngine.activeRaids.size;
  const activeHandlers = socketHandler.actionHandlers.size;
  
  if (activeRaids > 0 || activeHandlers > 0) {
    console.log(`📊 Active raids: ${activeRaids}, Action handlers: ${activeHandlers}`);
  }
}, 30000);

// ===== START SERVER =====
const port = 4000;
server.listen(port, () => {
  console.log('');
  console.log('🚀 Enhanced PTCG Raid Integration Demo Started!');
  console.log(`🌐 Server: http://localhost:${port}`);
  console.log(`🎮 Demo: http://localhost:${port}/demo`);
  console.log(`📊 Stats: http://localhost:${port}/api/raid/stats`);
  console.log('');
  console.log('🎯 Integration Features:');
  console.log('  ✅ TCGOfficialActionHandler - Server-side game logic');
  console.log('  ✅ EnhancedRaidSocketHandler - Real-time communication');
  console.log('  ✅ EnhancedRaidClient - Client-side integration');
  console.log('  ✅ Turn management with dynamic indicators');
  console.log('  ✅ Boss AI with threat assessment');
  console.log('  ✅ Spectator mode with auto-conversion');
  console.log('  ✅ Angular positioning system');
  console.log('  ✅ Complete error handling & validation');
  console.log('  ✅ Real-time multiplayer synchronization');
  console.log('');
  console.log('🧪 Testing:');
  console.log('  • Basic Demo: Single player game flow');
  console.log('  • Multiplayer Demo: 4-player coordination');
  console.log('  • Spectator Demo: Mode switching & chat');
  console.log('  • Stress Test: Rapid actions & edge cases');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down enhanced raid server...');
  socketHandler.shutdown();
  process.exit(0);
});