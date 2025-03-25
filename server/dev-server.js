// server/dev-server.js
/**
 * Development server for local testing
 *
 * This server mimics the behavior of Cloudflare Workers during development,
 * allowing you to test WebSocket connections locally without deploying.
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Setup directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../client');
const dbPath = path.join(__dirname, 'database/db.sqlite');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Make sure the database is initialized
async function initDatabase() {
  // Open SQLite database
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Create tables if they don't exist
  await db.exec(
    'CREATE TABLE IF NOT EXISTS KeyValuePairs (key TEXT PRIMARY KEY, value TEXT)'
  );

  return db;
}

// Function to generate random keys
function generateRandomKey(length) {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    key += characters.charAt(randomIndex);
  }
  return key;
}

async function main() {
  // Initialize database
  const db = await initDatabase();

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve static files from client directory
  app.use(express.static(clientDir));

  // API routes
  app.get('/api/importData', async (req, res) => {
    const key = req.query.key;
    if (!key) {
      return res.status(400).json({ error: 'Key parameter is missing' });
    }

    try {
      const row = await db.get(
        'SELECT value FROM KeyValuePairs WHERE key = ?',
        key
      );
      if (row) {
        return res.json(JSON.parse(row.value));
      } else {
        return res.status(404).json({ error: 'Key not found' });
      }
    } catch (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // For SPA routing, serve index.html for all unhandled routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
  });

  // Create HTTP server
  const server = http.createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server, path: '/websocket' });

  // Track rooms and clients
  const rooms = new Map();

  wss.on('connection', (ws, req) => {
    // Extract room ID from query parameters
    const url = new URL(req.url, `http://${req.headers.host}`);
    const roomId = url.searchParams.get('roomId') || 'default';

    console.log(`WebSocket connection established for room: ${roomId}`);

    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    // Add client to room
    const room = rooms.get(roomId);
    room.add(ws);

    // Store room ID on the WebSocket object
    ws.roomId = roomId;
    ws.isAlive = true;

    // Send connection confirmation
    ws.send(
      JSON.stringify({
        type: 'connection_established',
        roomId,
      })
    );

    // Handle WebSocket messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        console.log(`Received message of type: ${data.type}`);

        // Handle different message types
        if (data.type === 'storeGameState') {
          // Store game state in database
          const key = generateRandomKey(4);

          try {
            await db.run(
              'INSERT OR REPLACE INTO KeyValuePairs (key, value) VALUES (?, ?)',
              [key, data.exportData || '{}']
            );

            ws.send(
              JSON.stringify({
                type: 'exportGameStateSuccessful',
                key,
              })
            );
          } catch (error) {
            console.error('Error storing game state:', error);
            ws.send(
              JSON.stringify({
                type: 'exportGameStateFailed',
                message:
                  'Error exporting game! Please try again or save as a file.',
              })
            );
          }
        } else {
          // Broadcast message to all clients in the same room
          const room = rooms.get(ws.roomId);
          if (room) {
            room.forEach((client) => {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message.toString());
              }
            });
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    // Handle WebSocket closure
    ws.on('close', () => {
      console.log(`WebSocket connection closed for room: ${ws.roomId}`);

      // Remove client from room
      const room = rooms.get(ws.roomId);
      if (room) {
        room.delete(ws);

        // If room is empty, remove it
        if (room.size === 0) {
          rooms.delete(ws.roomId);
        }
      }
    });

    // Handle ping/pong for connection health checks
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // Ping all clients periodically to check connection health
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  // Start the server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Development server running at http://localhost:${PORT}`);
    console.log(
      `WebSocket server available at ws://localhost:${PORT}/websocket`
    );
  });
}

main().catch(console.error);
