import crypto from 'crypto';
import { getDatabase } from './db';

export interface User {
  id: number;
  username: string;
  email: string;
  realname?: string;
  createdAt: string;
}

export interface Session {
  sessionId: string;
  userId: number;
  expiresAt: number;
}

// Hash password using PBKDF2
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Verify password
export function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Generate session ID
export function generateSessionId(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create user
export async function createUser(username: string, email: string, password: string, realname?: string): Promise<User> {
  const db = getDatabase();
  
  // Check if user already exists
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    throw new Error('Username or email already exists');
  }
  
  // Hash password
  const hashedPassword = hashPassword(password);
  
  // Insert user
  const result = db.prepare(`
    INSERT INTO users (username, email, password, realname, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, email, hashedPassword, realname || null, new Date().toISOString());
  
  return {
    id: result.lastInsertRowid as number,
    username,
    email,
    realname,
    createdAt: new Date().toISOString(),
  };
}

// Get user by username
export async function getUserByUsername(username: string): Promise<User & { password: string } | null> {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  return user || null;
}

// Get user by ID
export async function getUserById(id: number): Promise<User | null> {
  const db = getDatabase();
  const user = db.prepare('SELECT id, username, email, realname, createdAt FROM users WHERE id = ?').get(id) as any;
  return user || null;
}

// Create session
export async function createSession(userId: number): Promise<string> {
  const db = getDatabase();
  const sessionId = generateSessionId();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  
  db.prepare(`
    INSERT INTO sessions (sessionId, userId, expiresAt)
    VALUES (?, ?, ?)
  `).run(sessionId, userId, expiresAt);
  
  return sessionId;
}

// Get session
export async function getSession(sessionId: string): Promise<Session | null> {
  const db = getDatabase();
  const session = db.prepare(`
    SELECT sessionId, userId, expiresAt 
    FROM sessions 
    WHERE sessionId = ? AND expiresAt > ?
  `).get(sessionId, Date.now()) as any;
  
  return session || null;
}

// Delete session
export async function deleteSession(sessionId: string): Promise<void> {
  const db = getDatabase();
  db.prepare('DELETE FROM sessions WHERE sessionId = ?').run(sessionId);
}

// Delete expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  const db = getDatabase();
  db.prepare('DELETE FROM sessions WHERE expiresAt < ?').run(Date.now());
}

// Verify credentials
export async function verifyCredentials(username: string, password: string): Promise<User | null> {
  const user = await getUserByUsername(username);
  if (!user) {
    return null;
  }
  
  if (!verifyPassword(password, user.password)) {
    return null;
  }
  
  // Return user without password
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    realname: user.realname,
    createdAt: user.createdAt,
  };
}

// Get current user from session ID (helper for API routes)
export async function getCurrentUser(sessionId: string | undefined): Promise<User | null> {
  if (!sessionId) {
    return null;
  }
  
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }
  
  return await getUserById(session.userId);
}

