// filename: cloudflare/migrations/01_create_tables.js
/**
 * Cloudflare D1 Database Migration
 * Purpose: Create initial tables for PTCG Simulator database
 * @author: [Your Name]
 * @created: April 28, 2025
 */

export async function up(db) {
    console.log("Creating tables...");
    
    // Create cards table
    await db.exec(`
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create decks table
    await db.exec(`
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
      );
    `);
    
    // Create update_versions table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS update_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL,
        update_list_url TEXT NOT NULL,
        description TEXT,
        release_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create custom_card_sets table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS custom_card_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        set_code TEXT NOT NULL UNIQUE,
        set_name TEXT NOT NULL,
        description TEXT,
        created_by TEXT,
        card_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create format_definitions table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS format_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        included_sets TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create config table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log("Tables created successfully!");
    
    // Seed initial data
    console.log("Seeding initial data...");
    
    // Seed config with lackey_update_url
    await db.exec(`
      INSERT INTO config (key, value, description)
      VALUES (
        'lackey_update_url', 
        'https://ptcgcustomplugin.s3.us-east-2.amazonaws.com/updatelist.txt', 
        'URL for LackeyCCG-style update list'
      );
    `);
    
    // Seed update_versions table with default LackeyCCG update location
    await db.exec(`
      INSERT INTO update_versions (version, update_list_url, description)
      VALUES ('240428', 'https://ptcgcustomplugin.s3.us-east-2.amazonaws.com/updatelist.txt', 'Initial update list');
    `);
    
    // Seed format_definitions table
    await db.exec(`
      INSERT INTO format_definitions (name, description, included_sets)
      VALUES 
      ('Standard', 'Current Standard Format', 'SVI,PAL,OBF,MEW,PAR,TEF,TWM,SFA'),
      ('Expanded', 'Expanded Format - Black & White onwards', 'BLW,NXD,DEX,DRX,BCR,PLS,PLF,PLB,XY,FLF,FFI,PHF,PRC,DCR,ROS,AOR,BKT,BKP,GEN,FCO,STS,EVO,SUM,GRI,BUS,SLG,CIN,UPR,FLI,CES,DRM,LOT,TEU,UNB,UNM,CEC,SSH,RCL,DAA,CPA,VIV,SHF,BST,CRE,EVS,CEL,FST,BRS,ASR,PGO,LOR,SIT,CRZ,SVI,PAL,OBF,MEW,PAR,TEF,TWM,SFA'),
      ('Legacy', 'Legacy Format - HeartGold SoulSilver to Black & White', 'HGSS,HS,UL,UD,TM,CL,BLW,NXD,DEX,DRX,BCR,PLS,PLF,PLB'),
      ('DPPt-Era', 'Diamond & Pearl through Platinum Eras', 'DP,MT,SW,GE,MD,LA,SF,PL,RR,SV,AR'),
      ('Custom Modern', 'Custom modern sets', 'WF2,FBA,FAL,SMPROMO,RXS,HST,LWO,PLR'),
      ('Forte', 'Format for Forte specialized cards and mechanics', 'FORTE,SVI,PAL,OBF,MEW,HST,LWO');
    `);
    
    // Seed custom_card_sets table
    await db.exec(`
      INSERT INTO custom_card_sets (set_code, set_name, description, created_by)
      VALUES 
      ('FORTE', 'Forte Cards', 'Specialized Forte format cards with unique mechanics', 'Your Name');
    `);
    
    console.log("Initial data seeded successfully!");
    console.log("Database initialization complete!");
  }
  
  export async function down(db) {
    await db.exec('DROP TABLE IF EXISTS cards;');
    await db.exec('DROP TABLE IF EXISTS decks;');
    await db.exec('DROP TABLE IF EXISTS update_versions;');
    await db.exec('DROP TABLE IF EXISTS custom_card_sets;');
    await db.exec('DROP TABLE IF EXISTS format_definitions;');
    await db.exec('DROP TABLE IF EXISTS config;');
  }
  
  // Execute when running directly with wrangler
  if (typeof db !== 'undefined') {
    up(db)
      .catch(err => console.error('Deployment failed:', err));
  }