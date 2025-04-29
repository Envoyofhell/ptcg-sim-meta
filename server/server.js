// Modifications to server.js to add Cloudflare D1 database support

// Import D1 module
import { D1Database } from '@cloudflare/workers-types';

// Add D1 binding to the env object
async function main() {

// Add database initialization in the main function
async function main() {
  // ... existing code ...
  
  // Initialize D1 database if we're in Cloudflare environment
  let db;
  if (process.env.CF_PAGES === 'true') {
    // Running on Cloudflare Pages with D1
    // The DB binding will be automatically available
  } else {
    // Running locally or on render.com
    // Use SQLite for development and local testing
    const dbFilePath = 'database/db.sqlite';
    db = new sqlite3.Database(dbFilePath);
    // Create tables if they don't exist
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS KeyValuePairs (
          key TEXT PRIMARY KEY, 
          value TEXT
        )
      `);
      
      // Add tables for cards, decks, etc. to match Cloudflare D1 schema
      db.run(`
        CREATE TABLE IF NOT EXISTS cards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          set TEXT NOT NULL,
          set_number TEXT,
          image_file TEXT,
          type TEXT,
          stage TEXT,
          hp TEXT,
          weakness TEXT,
          resistance TEXT,
          retreat_cost TEXT,
          rarity TEXT,
          designer TEXT,
          illustrator TEXT,
          script TEXT,
          text TEXT,
          image_url TEXT,
          // ... continued from previous code

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS decks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          subcategory TEXT,
          format TEXT,
          description TEXT,
          content TEXT NOT NULL,
          user_id TEXT,
          is_public BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS update_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version TEXT NOT NULL,
          update_list_url TEXT NOT NULL,
          description TEXT,
          release_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS custom_card_sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          set_code TEXT NOT NULL UNIQUE,
          set_name TEXT NOT NULL,
          description TEXT,
          created_by TEXT,
          card_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      db.run(`
        CREATE TABLE IF NOT EXISTS format_definitions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          included_sets TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });
  }


  // Add new API routes for database operations
  app.get('/api/cards', async (req, res) => {
    try {
      const { set, name, type } = req.query;
      
      let query = "SELECT * FROM cards";
      let conditions = [];
      let params = [];
      
      if (set) {
        conditions.push("set = ?");
        params.push(set);
      }
      
      if (name) {
        conditions.push("name LIKE ?");
        params.push(`%${name}%`);
      }
      
      if (type) {
        conditions.push("type = ?");
        params.push(type);
      }
      
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      
      if (process.env.CF_PAGES === 'true') {
        // Cloudflare D1
        const { results } = await env.DB.prepare(query).bind(...params).all();
        res.json(results);
      } else {
        // SQLite
        db.all(query, params, (err, rows) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json(rows);
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get('/api/config', async (req, res) => {
    try {
      const { key } = req.query;
      
      if (!key) {
        return res.status(400).json({ error: 'Key parameter required' });
      }
      
      if (process.env.CF_PAGES === 'true') {
        // Cloudflare D1
        const { results } = await env.DB.prepare(
          "SELECT * FROM config WHERE key = ?"
        ).bind(key).all();
        
        if (results.length === 0) {
          return res.status(404).json({ error: 'Configuration key not found' });
        }
        
        res.json(results[0]);
      } else {
        // SQLite
        db.get(
          "SELECT * FROM config WHERE key = ?",
          [key],
          (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (!row) {
              return res.status(404).json({ error: 'Configuration key not found' });
            }
            
            res.json(row);
          }
        );
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/forte/import', async (req, res) => {
    try {
      const forteCards = req.body;
      
      if (!Array.isArray(forteCards)) {
        return res.status(400).json({ error: 'Expected array of Forte cards' });
      }
      
      if (process.env.CF_PAGES === 'true') {
        // Cloudflare D1 - Use batch operations
        const batch = [];
        
        for (const card of forteCards) {
          // Ensure set is FORTE
          card.set = 'FORTE';
          
          batch.push(env.DB.prepare(`
            INSERT INTO cards (name, set, set_number, image_file, type, stage, hp, weakness, resistance, retreat_cost, rarity, designer, illustrator, script, text, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            card.name, card.set, card.setNumber, card.imageFile, card.type, card.stage, 
            card.hp, card.weakness, card.resistance, card.retreatCost, card.rarity, 
            card.designer, card.illustrator, card.script, card.text, card.imageUrl
          ));
        }
        
        await env.DB.batch(batch);
        
        // Update card count
        await env.DB.prepare(`
          UPDATE custom_card_sets 
          SET card_count = (SELECT COUNT(*) FROM cards WHERE set = 'FORTE')
          WHERE set_code = 'FORTE'
        `).run();
        
        res.json({ success: true, count: forteCards.length });
      } else {
        // SQLite
        const stmt = db.prepare(`
          INSERT INTO cards (name, set, set_number, image_file, type, stage, hp, weakness, resistance, retreat_cost, rarity, designer, illustrator, script, text, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          for (const card of forteCards) {
            // Ensure set is FORTE
            card.set = 'FORTE';
            
            stmt.run(
              card.name, card.set, card.setNumber, card.imageFile, card.type, card.stage, 
              card.hp, card.weakness, card.resistance, card.retreatCost, card.rarity, 
              card.designer, card.illustrator, card.script, card.text, card.imageUrl
            );
          }
          
          db.run('COMMIT', err => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Update card count
            db.run(`
              UPDATE custom_card_sets 
              SET card_count = (SELECT COUNT(*) FROM cards WHERE set = 'FORTE')
              WHERE set_code = 'FORTE'
            `);
            
            res.json({ success: true, count: forteCards.length });
          });
        });
        
        stmt.finalize();
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get('/api/cards/image', async (req, res) => {
    try {
      const { set, number } = req.query;
      
      if (!set || !number) {
        return res.status(400).json({ error: 'Set and number parameters required' });
      }
      
      const query = "SELECT image_url, type FROM cards WHERE set = ? AND set_number = ?";
      
      if (process.env.CF_PAGES === 'true') {
        // Cloudflare D1
        const { results } = await env.DB.prepare(query).bind(set, number).all();
        if (results.length > 0) {
          res.json({ imageUrl: results[0].image_url, type: results[0].type });
        } else {
          res.status(404).json({ error: 'Card not found' });
        }
      } else {
        // SQLite
        db.get(query, [set, number], (err, row) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (row) {
            res.json({ imageUrl: row.image_url, type: row.type });
          } else {
            res.status(404).json({ error: 'Card not found' });
          }
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get('/api/cards/byName', async (req, res) => {
    try {
      const { name } = req.query;
      
      if (!name) {
        return res.status(400).json({ error: 'Name parameter required' });
      }
      
      const query = "SELECT id, name, set, set_number, type, image_url FROM cards WHERE name LIKE ?";
      
      if (process.env.CF_PAGES === 'true') {
        // Cloudflare D1
        const { results } = await env.DB.prepare(query).bind(`%${name}%`).all();
        res.json(results);
      } else {
        // SQLite
        db.all(query, [`%${name}%`], (err, rows) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json(rows);
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/cards', async (req, res) => {
    try {
      const cards = req.body;
      
      if (!Array.isArray(cards)) {
        return res.status(400).json({ error: 'Expected array of cards' });
      }
      
      if (process.env.CF_PAGES === 'true') {
        // Cloudflare D1 - Use batch operations
        const batch = [];
        
        for (const card of cards) {
          batch.push(env.DB.prepare(`
            INSERT INTO cards (name, set, set_number, image_file, type, stage, hp, weakness, resistance, retreat_cost, rarity, designer, illustrator, script, text, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            card.name, card.set, card.setNumber, card.imageFile, card.type, card.stage, 
            card.hp, card.weakness, card.resistance, card.retreatCost, card.rarity, 
            card.designer, card.illustrator, card.script, card.text, card.imageUrl
          ));
        }
        
        await env.DB.batch(batch);
        res.json({ success: true, count: cards.length });
      } else {
        // SQLite
        const stmt = db.prepare(`
          INSERT INTO cards (name, set, set_number, image_file, type, stage, hp, weakness, resistance, retreat_cost, rarity, designer, illustrator, script, text, image_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          
          for (const card of cards) {
            stmt.run(
              card.name, card.set, card.setNumber, card.imageFile, card.type, card.stage, 
              card.hp, card.weakness, card.resistance, card.retreatCost, card.rarity, 
              card.designer, card.illustrator, card.script, card.text, card.imageUrl
            );
          }
          
          db.run('COMMIT', err => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ success: true, count: cards.length });
          });
        });
        
        stmt.finalize();
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get('/api/decks', async (req, res) => {
    try {
      const { id, category, subcategory, format } = req.query;
      
      if (id) {
        // Get specific deck
        const query = "SELECT * FROM decks WHERE id = ?";
        
        if (process.env.CF_PAGES === 'true') {
          // Cloudflare D1
          const { results } = await env.DB.prepare(query).bind(id).all();
          
          if (results.length === 0) {
            return res.status(404).json({ error: 'Deck not found' });
          }
          
          res.json(results[0]);
        } else {
          // SQLite
          db.get(query, [id], (err, row) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (!row) {
              return res.status(404).json({ error: 'Deck not found' });
            }
            
            res.json(row);
          });
        }
        
        return;
      }
      
      // List decks with optional filtering
      let query = "SELECT id, name, category, subcategory, format, description, created_at FROM decks";
      let conditions = [];
      let params = [];
      
      if (category) {
        conditions.push("category = ?");
        params.push(category);
      }
      
      if (subcategory) {
        conditions.push("subcategory = ?");
        params.push(subcategory);
      }
      
      if (format) {
        conditions.push("format = ?");
        params.push(format);
      }
      
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
      
      query += " ORDER BY created_at DESC";
      
      if (process.env.CF_PAGES === 'true') {
        // Cloudflare D1
        const { results } = await env.DB.prepare(query).bind(...params).all();
        res.json(results);
      } else {
        // SQLite
        db.all(query, params, (err, rows) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          res.json(rows);
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post('/api/decks', async (req, res) => {
    try {
      const { name, category, subcategory, format, description, content, user_id, is_public } = req.body;
      
      if (!name || !content) {
        return res.status(400).json({ error: 'Name and content are required' });
      }
      
      const query = `
        INSERT INTO decks (name, category, subcategory, format, description, content, user_id, is_public)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      if (process.env.CF_PAGES === 'true') {
        // Cloudflare D1
        const result = await env.DB.prepare(query).bind(
          name,
          category || 'Custom',
          subcategory || null,
          format || 'Standard',
          description || '',
          content,
          user_id || null,
          is_public || false
        ).run();
        
        res.json({ 
          success: true, 
          id: result.meta?.last_row_id || null 
        });
      } else {
        // SQLite
        db.run(query, [
          name,
          category || 'Custom',
          subcategory || null,
          format || 'Standard',
          description || '',
          content,
          user_id || null,
          is_public || false
        ], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({ 
            success: true, 
            id: this.lastID 
          });
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get('/api/updates', async (req, res) => {
    try {
      const { version } = req.query;
      
      if (!version) {
        return res.status(400).json({ error: 'Version parameter required' });
      }
      
      const query = `
        SELECT * FROM update_versions 
        WHERE version > ? 
        ORDER BY version DESC 
        LIMIT 1
      `;
      
      if (process.env.CF_PAGES === 'true') {
        // Cloudflare D1
        const { results } = await env.DB.prepare(query).bind(version).all();
        
        if (results.length === 0) {
          return res.json({ updates_available: false });
        }
        
        res.json({
          updates_available: true,
          current_version: version,
          latest_version: results[0].version,
          update_list_url: results[0].update_list_url,
          description: results[0].description
        });
      } else {
        // SQLite
        db.get(query, [version], (err, row) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (!row) {
            return res.json({ updates_available: false });
          }
          
          res.json({
            updates_available: true,
            current_version: version,
            latest_version: row.version,
            update_list_url: row.update_list_url,
            description: row.description
          });
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Add endpoint to process LackeyCCG-style update list
  app.get('/api/process-update-list', async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url) {
        return res.status(400).json({ error: 'URL parameter required' });
      }
      
      // Fetch the update list
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch update list: ${response.status} ${response.statusText}`);
      }
      
      const updateListText = await response.text();
      const updates = [];
      
      // Parse the update list format
      const lines = updateListText.split('\n');
      let currentDate = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;
        
        // First line typically contains plugin name and date
        if (i === 0) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            currentDate = parts[1];
          }
          continue;
        }
        
        // Typical line format: path/to/file.ext URL checksum
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const filePath = parts[0].trim();
          const fileUrl = parts[1].trim();
          const checksum = parts.length >= 3 ? parts[2].trim() : '';
          
          updates.push({
            filePath,
            fileUrl,
            checksum
          });
        }
      }
      
      // Process carddata.txt file if it exists
      const carddataFile = updates.find(update => 
        update.filePath.endsWith('carddata.txt') || 
        update.filePath.includes('/sets/carddata')
      );
      
      if (carddataFile) {
        // Fetch the carddata file
        const carddataResponse = await fetch(carddataFile.fileUrl);
        
        if (!carddataResponse.ok) {
          throw new Error(`Failed to fetch carddata: ${carddataResponse.status} ${carddataResponse.statusText}`);
        }
        
        const carddataText = await carddataResponse.text();
        
        // Parse the tab-delimited carddata format
        const cards = parseCarddataFile(carddataText);
        
        // Insert the cards into the database
        if (process.env.CF_PAGES === 'true') {
          // Cloudflare D1 - Insert in batches
          const batchSize = 100;
          
          for (let i = 0; i < cards.length; i += batchSize) {
            const batch = cards.slice(i, i + batchSize).map(card => 
              env.DB.prepare(`
                INSERT OR REPLACE INTO cards 
                (name, set, set_number, image_file, type, stage, hp, weakness, resistance, retreat_cost, rarity, designer, illustrator, script, text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                card.name,
                card.set,
                card.setNumber,
                card.imageFile,
                card.type,
                card.stage,
                card.hp,
                card.weakness,
                card.resistance,
                card.retreatCost,
                card.rarity,
                card.designer,
                card.illustrator,
                card.script,
                card.text
              )
            );
            
            await env.DB.batch(batch);
          }
        } else {
          // SQLite
          const stmt = db.prepare(`
            INSERT OR REPLACE INTO cards 
            (name, set, set_number, image_file, type, stage, hp, weakness, resistance, retreat_cost, rarity, designer, illustrator, script, text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            for (const card of cards) {
              stmt.run(
                card.name,
                card.set,
                card.setNumber,
                card.imageFile,
                card.type,
                card.stage,
                card.hp,
                card.weakness,
                card.resistance,
                card.retreatCost,
                card.rarity,
                card.designer,
                card.illustrator,
                card.script,
                card.text
              );
            }
            
            db.run('COMMIT');
          });
          
          stmt.finalize();
        }
      }
      
      // Register this update in the database
      if (currentDate) {
        if (process.env.CF_PAGES === 'true') {
          await env.DB.prepare(`
            INSERT INTO update_versions (version, update_list_url, description)
            VALUES (?, ?, ?)
          `).bind(
            currentDate,
            url,
            `Processed update from ${url}`
          ).run();
        } else {
          db.run(`
            INSERT INTO update_versions (version, update_list_url, description)
            VALUES (?, ?, ?)
          `, [
            currentDate,
            url,
            `Processed update from ${url}`
          ]);
        }
      }
      
      res.json({
        success: true,
        date: currentDate,
        files_processed: updates.length,
        cards_processed: carddataFile ? cards.length : 0
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ... existing socket.io and server configuration
}

// Helper function to parse carddata.txt file
function parseCarddataFile(carddataText) {
  const lines = carddataText.split('\n');
  
  // First line contains column headers
  if (lines.length < 2) {
    return [];
  }
  
  const headers = lines[0].split('\t');
  const cards = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    const values = line.split('\t');
    const card = {};
    
    // Map values to their corresponding headers
    for (let j = 0; j < Math.min(headers.length, values.length); j++) {
      const header = headers[j].toLowerCase().replace(/\s+/g, '');
      card[mapHeaderToField(header)] = values[j];
    }
    
    // Skip entries without a name or set
    if (!card.name || !card.set) continue;
    
    cards.push(card);
  }
  
  return cards;
}

// Helper function to map header names to field names
function mapHeaderToField(header) {
  const mapping = {
    'name': 'name',
    'set': 'set',
    'imagefile': 'imageFile',
    'set#': 'setNumber',
    'setnumber': 'setNumber',
    'type': 'type',
    'stage': 'stage',
    'hp': 'hp',
    'weakness': 'weakness',
    'resistance': 'resistance',
    'retreatcost': 'retreatCost',
    'rarity': 'rarity',
    'designer': 'designer',
    'illustration': 'illustrator',
    'illustrator': 'illustrator',
    'script': 'script',
    'text': 'text'
  };
  
  return mapping[header] || header;
}

}