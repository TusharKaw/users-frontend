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
  // Users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      realname TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      sessionId TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      expiresAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Comments table
  database.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pageId INTEGER NOT NULL,
      pageTitle TEXT NOT NULL,
      text TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Anonymous',
      parentCommentId INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parentCommentId) REFERENCES comments(id) ON DELETE CASCADE
    )
  `);

  // Migrations: Add parentCommentId column if it doesn't exist
  try {
    const tableInfo = database.prepare(`PRAGMA table_info(comments)`).all() as Array<{ name: string }>;
    const hasParentCommentId = tableInfo.some(col => col.name === 'parentCommentId');
    
    if (!hasParentCommentId) {
      console.log('Adding parentCommentId column to comments table...');
      database.exec(`
        ALTER TABLE comments ADD COLUMN parentCommentId INTEGER;
      `);
      // Add foreign key constraint (SQLite doesn't support adding FK after table creation, so we skip it)
      // The FK will be enforced by the application logic
    }
  } catch (error: any) {
    console.error('Error migrating comments table:', error);
    // Continue anyway - column might already exist
  }

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

  // Comment votes table
  database.exec(`
    CREATE TABLE IF NOT EXISTS comment_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commentId INTEGER NOT NULL,
      author TEXT NOT NULL,
      vote INTEGER NOT NULL CHECK(vote IN (1, -1)),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (commentId) REFERENCES comments(id) ON DELETE CASCADE,
      UNIQUE(commentId, author)
    )
  `);

  // Create indexes for better performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
    CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions(expiresAt);
    CREATE INDEX IF NOT EXISTS idx_comments_pageId ON comments(pageId);
    CREATE INDEX IF NOT EXISTS idx_comments_parentCommentId ON comments(parentCommentId);
    CREATE INDEX IF NOT EXISTS idx_ratings_pageId ON ratings(pageId);
    CREATE INDEX IF NOT EXISTS idx_ratings_pageId_author ON ratings(pageId, author);
    CREATE INDEX IF NOT EXISTS idx_comment_votes_commentId ON comment_votes(commentId);
    CREATE INDEX IF NOT EXISTS idx_comment_votes_commentId_author ON comment_votes(commentId, author);
  `);
}

// Close database connection (for cleanup)
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

