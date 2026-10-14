import {hashPassword} from './auth.js';
import {db} from './database.js';

const email = process.env.ZLOG_OWNER_EMAIL?.trim().toLowerCase();
const password = process.env.ZLOG_OWNER_PASSWORD;

if (!email || !password) {
  throw new Error('Set ZLOG_OWNER_EMAIL and ZLOG_OWNER_PASSWORD before running setup-owner.');
}
if (!/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error('ZLOG_OWNER_EMAIL must be a valid email address.');
}
if (password.length < 12) {
  throw new Error('ZLOG_OWNER_PASSWORD must contain at least 12 characters.');
}
if (db.prepare('SELECT id FROM users LIMIT 1').get()) {
  throw new Error('An owner already exists. Zlog supports one owner only.');
}

const passwordHash = await hashPassword(password);
db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, passwordHash);
console.log(`Created Zlog owner ${email}.`);
