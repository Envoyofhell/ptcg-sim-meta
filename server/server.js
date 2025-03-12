import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';
import bcrypt from 'bcryptjs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg'; // Correct pg import
const { Pool } = pg; //destructure pool
import ejs from 'ejs'; // Correct ejs import
import { fileURLToPath } from 'url';

// Handle __dirname in ES modules and adjust for client folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.join(__dirname, '../client');
const envFilePath = path.join(__dirname, 'socket-admin-password.env');
dotenv.config({ path: envFilePath });

// PostgreSQL Connection Pool

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

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
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
  connectionStateRecovery: {},
  cors: {
    origin: [
      'https://admin.socket.io', // Admin interface for Socket.IO
      'https://ptcg-sim-meta.vercel.app', // Your new Vercel domain
     // 'https://ptcgsim.online/', // If still needed; else remove
    ],
    credentials: true,
  },
});

  try {
    await pool.query(
      'CREATE TABLE IF NOT EXISTS KeyValuePairs (key TEXT PRIMARY KEY, value TEXT)'
    );
  } catch (err) {
    console.error('Error creating table:', err);
  }

  const saltRounds = 10;
  const plainPassword = process.env.ADMIN_PASSWORD || 'defaultPassword';
  const hashedPassword = bcrypt.hashSync(plainPassword, saltRounds);

  instrument(io, {
    auth: {
      type: 'basic',
      username: 'admin',
      password: hashedPassword,
    },
    mode: 'development',
  });

  app.set('view engine', 'ejs');
  app.set('views', clientDir);
  app.use(cors());
  app.use(express.static(clientDir));
  app.get('/', (_, res) => {
    res.render('index', { importDataJSON: null });
  });

  app.get('/import', async (req, res) => {
    const key = req.query.key;
    if (!key) {
      return res.status(400).json({ error: 'Key parameter is missing' });
    }

    try {
      const result = await pool.query(
        'SELECT value FROM KeyValuePairs WHERE key = $1',
        [key]
      );

      if (result.rows.length > 0) {
        res.render('index', { importDataJSON: result.rows[0].value });
      } else {
        res.status(404).json({ error: 'Key not found' });
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  const roomInfo = new Map();
  const cleanUpEmptyRooms = () => {
    roomInfo.forEach((room, roomId) => {
      if (room.players.size === 0 && room.spectators.size === 0) {
        roomInfo.delete(roomId);
      }
    });
  };
  setInterval(cleanUpEmptyRooms, 5 * 60 * 1000);

  io.on('connection', async (socket) => {
    socket.on('storeGameState', async (exportData) => {
      try {
        const key = generateRandomKey(4);
        await pool.query(
          'INSERT INTO KeyValuePairs (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
          [key, exportData]
        );
        socket.emit('exportGameStateSuccessful', key);
      } catch (err) {
        console.error('Error storing data:', err);
        socket.emit(
          'exportGameStateFailed',
          'Error exporting game! Please try again or save as a file.'
        );
      }
    });
    // Function to handle disconnections (unintended)
    const disconnectHandler = (roomId, username) => {
      if (!socket.data.leaveRoom) {
        socket.to(roomId).emit('userDisconnected', username);
      }
      // Remove the disconnected user from the roomInfo map
      if (roomInfo.has(roomId)) {
        const room = roomInfo.get(roomId);

        if (room.players.has(username)) {
          room.players.delete(username);
        } else if (room.spectators.has(username)) {
          room.spectators.delete(username);
        }

        // If both players and spectators are empty, remove the roomInfo entry
        if (room.players.size === 0 && room.spectators.size === 0) {
          roomInfo.delete(roomId);
        }
      }
    };
    // Function to handle event emission
    const emitToRoom = (eventName, data) => {
      socket.broadcast.to(data.roomId).emit(eventName, data);
      if (eventName === 'leaveRoom') {
        socket.leave(data.roomId);
        if (socket.data.disconnectListener) {
          socket.data.leaveRoom = true;
          socket.data.disconnectListener();
          socket.removeListener('disconnect', socket.data.disconnectListener);
          socket.data.leaveRoom = false;
        }
      }
    };

    socket.on('joinGame', (roomId, username, isSpectator) => {
      if (!roomInfo.has(roomId)) {
        roomInfo.set(roomId, { players: new Set(), spectators: new Set() });
      }
      const room = roomInfo.get(roomId);

      if (room.players.size < 2 || isSpectator) {
        socket.join(roomId);
        // Check if the user is a spectator or there are fewer than 2 players
        if (isSpectator) {
          room.spectators.add(username);
          socket.emit('spectatorJoin');
        } else {
          room.players.add(username);
          socket.emit('joinGame');
          socket.data.disconnectListener = () =>
            disconnectHandler(roomId, username);
          socket.on('disconnect', socket.data.disconnectListener);
        }
      } else {
        socket.emit('roomReject');
      }
    });

    socket.on('userReconnected', (data) => {
      if (!roomInfo.has(data.roomId)) {
        roomInfo.set(data.roomId, {
          players: new Set(),
          spectators: new Set(),
        });
      }
      const room = roomInfo.get(data.roomId);
      socket.join(data.roomId);
      if (!data.notSpectator) {
        room.spectators.add(data.username);
      } else {
        room.players.add(data.username);
        socket.data.disconnectListener = () =>
          disconnectHandler(data.roomId, data.username);
        socket.on('disconnect', socket.data.disconnectListener);
        io.to(data.roomId).emit('userReconnected', data);
      }
    });

    // List of socket events
    const events = [
      'leaveRoom',
      'requestAction',
      'pushAction',
      'resyncActions',
      'catchUpActions',
      'syncCheck',
      'appendMessage',
      'spectatorActionData',
      'initiateImport',
      'endImport',
      'lookAtCards',
      'stopLookingAtCards',
      'revealCards',
      'hideCards',
      'revealShortcut',
      'hideShortcut',
      'lookShortcut',
      'stopLookingShortcut',
    ];
// Add the error handling middleware here
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
});
    // Register event listeners using the common function
    for (const event of events) {
      socket.on(event, (data) => {
        emitToRoom(event, data);
      });
    }
  });

  // Port Configuration
  const port = process.env.PORT || 4000;
  server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
  });
}

main();
