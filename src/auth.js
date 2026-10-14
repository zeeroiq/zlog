import crypto from 'node:crypto';
import {promisify} from 'node:util';
import {db} from './database.js';

const scrypt = promisify(crypto.scrypt);
const sessionLifetimeMs = 1000 * 60 * 60 * 24 * 14;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password, storedPassword) {
  const [salt, storedHash] = storedPassword.split(':');
  if (!salt || !storedHash) {
    return false;
  }

  const derivedHash = await scrypt(password, salt, 64);
  const expectedHash = Buffer.from(storedHash, 'hex');
  return expectedHash.length === derivedHash.length && crypto.timingSafeEqual(expectedHash, derivedHash);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString();

  db.prepare(`INSERT INTO sessions (user_id, token_hash, csrf_token, expires_at)
    VALUES (?, ?, ?, ?)`)
    .run(userId, tokenHash, csrfToken, expiresAt);

  return {token, csrfToken, expiresAt};
}

export function getSession(token) {
  if (!token) {
    return null;
  }

  const session = db.prepare(`SELECT sessions.id, sessions.user_id, sessions.csrf_token,
    sessions.expires_at, users.email
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`)
    .get(hashToken(token), new Date().toISOString());

  return session ?? null;
}

export function destroySession(token) {
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
}

export function clearExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
