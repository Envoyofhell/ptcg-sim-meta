// ===== REPLACE THIS IN YOUR server/server.js =====

// OLD CODE (remove/comment out):
// import sqlite3 from 'sqlite3';
// const db = new sqlite3.Database(dbFilePath);

// NEW CODE (replace with this):
import Database from 'better-sqlite3';
import fs from 'fs';

// Ensure database directory exists
const dbDir = './database';
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbFilePath = './database/db.sqlite';
const db = new Database(dbFilePath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Replace your db.serialize() section with this:
// (better-sqlite3 doesn't need serialize, it's synchronous)

try {
  // Create your existing tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS KeyValuePairs (
      key TEXT PRIMARY KEY, 
      value TEXT
    );
    
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
  
  console.log('✅ Database initialized at:', dbFilePath);
} catch (err) {
  console.error('❌ Database setup error:', err);
}

// ===== UPDATE YOUR DATABASE CALLS =====

// CHANGE database operations from callback style to synchronous:

// OLD sqlite3 style:
// db.run('INSERT INTO...', [params], (err) => { ... });

// NEW better-sqlite3 style:
// const stmt = db.prepare('INSERT INTO...');
// stmt.run(params);

// For your existing code, update these patterns:

// OLD:
// db.run('INSERT OR REPLACE INTO KeyValuePairs (key, value) VALUES (?, ?)', [key, value], (err) => {
//   if (err) { ... } else { ... }
// });

// NEW:
// try {
//   const stmt = db.prepare('INSERT OR REPLACE INTO KeyValuePairs (key, value) VALUES (?, ?)');
//   stmt.run(key, value);
//   // success
// } catch (err) {
//   // error
// }

// OLD:
// db.get('SELECT value FROM KeyValuePairs WHERE key = ?', [key], (err, row) => {
//   if (err) { ... } else { ... }
// });

// NEW:
// try {
//   const stmt = db.prepare('SELECT value FROM KeyValuePairs WHERE key = ?');
//   const row = stmt.get(key);
//   // use row
// } catch (err) {
//   // error
// }

// ===== RAID MANAGER UPDATES =====
// If you're using the RaidManager, update the database calls there too:

// In RaidManager.js, change:
// this.db.run('INSERT INTO raid_instances...', [...], (err) => {});

// To:
// try {
//   const stmt = this.db.prepare('INSERT INTO raid_instances (id, type, config, state) VALUES (?, ?, ?, ?)');
//   stmt.run(raidId, config.type, JSON.stringify(config), 'lobby');
// } catch (err) {
//   console.error('Database error:', err);
// }