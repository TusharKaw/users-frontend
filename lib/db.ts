import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database file path
const dbPath = path.join(process.cwd(), 'data', 'comments-ratings.db');
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (db) {
    return db;
  }

  try {
    db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Initialize schema
    initializeSchema(db);
    
    return db;
  } catch (error: any) {
    console.error('Error initializing database:', error);
    throw new Error(`Failed to initialize database: ${error.message}`);
  }
}

function initializeSchema(database: Database.Database) {
  // Comments table
  database.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pageId INTEGER NOT NULL,
      pageTitle TEXT NOT NULL,
      text TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Anonymous',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ratings table
  database.exec(`
    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pageId INTEGER NOT NULL,
      pageTitle TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      author TEXT NOT NULL DEFAULT 'Anonymous',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create unique index for pageId + author combination
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_pageId_author 
    ON ratings(pageId, author)
  `);

  // Create indexes for better performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_comments_pageId ON comments(pageId);
    CREATE INDEX IF NOT EXISTS idx_ratings_pageId ON ratings(pageId);
    CREATE INDEX IF NOT EXISTS idx_ratings_pageId_author ON ratings(pageId, author);
  `);
}

// Close database connection (for cleanup)
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

