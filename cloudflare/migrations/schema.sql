-- Create cards table
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  [set] TEXT NOT NULL,
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

-- Create decks table
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