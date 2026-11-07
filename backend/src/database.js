import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dataDirectory = process.env.ZLOG_DATA_DIR ?? fileURLToPath(new URL('../../data/', import.meta.url));

fs.mkdirSync(dataDirectory, {recursive: true});

export const db = new Database(path.join(dataDirectory, 'zlog.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    body_markdown TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    csrf_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS posts_public_index ON posts(status, published_at DESC);
  CREATE INDEX IF NOT EXISTS sessions_expiry_index ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS page_views (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL,
    visitor_id TEXT,
    ip_address TEXT,
    ip_hash TEXT,
    device_type TEXT CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'bot')) DEFAULT 'desktop',
    os TEXT,
    browser TEXT,
    user_agent TEXT,
    is_returning INTEGER NOT NULL DEFAULT 0,
    is_page_repeat INTEGER NOT NULL DEFAULT 0,
    visit_number INTEGER NOT NULL DEFAULT 1,
    viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS page_views_path_index ON page_views(path);

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    confirmed INTEGER NOT NULL DEFAULT 0,
    subscribed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export function closeDatabase() {
  db.close();
}

// ---------------------------------------------------------------------------
// Schema migrations — ADD COLUMN is idempotent-safe via the existence check.
// SQLite does not support IF NOT EXISTS on ALTER TABLE, so we inspect the
// current column list first and only run the statement when needed.
// ---------------------------------------------------------------------------
(function migratePageViews() {
  const existing = new Set(
    db.prepare('PRAGMA table_info(page_views)').all().map(c => c.name)
  );
  const additions = [
    ['visitor_id',     'TEXT'],
    ['ip_address',     'TEXT'],
    ['ip_hash',        'TEXT'],
    ['device_type',    "TEXT CHECK(device_type IN ('desktop','mobile','tablet','bot')) DEFAULT 'desktop'"],
    ['os',             'TEXT'],
    ['browser',        'TEXT'],
    ['user_agent',     'TEXT'],
    ['is_returning',   'INTEGER NOT NULL DEFAULT 0'],
    ['is_page_repeat', 'INTEGER NOT NULL DEFAULT 0'],
    ['visit_number',   'INTEGER NOT NULL DEFAULT 1'],
  ];
  for (const [col, def] of additions) {
    if (!existing.has(col)) {
      db.exec(`ALTER TABLE page_views ADD COLUMN ${col} ${def}`);
    }
  }
  // Indexes on added columns — safe to run after columns are ensured to exist.
  db.exec(`
    CREATE INDEX IF NOT EXISTS page_views_path_index ON page_views(path);
    CREATE INDEX IF NOT EXISTS page_views_visitor_index ON page_views(visitor_id);
    CREATE INDEX IF NOT EXISTS page_views_ip_index ON page_views(ip_address);
    CREATE INDEX IF NOT EXISTS page_views_viewed_at_index ON page_views(viewed_at DESC);
  `);
}());