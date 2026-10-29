import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { STATUSES } from '../../shared/statusRules.js';

export const DEFAULT_DATABASE_PATH = path.resolve(import.meta.dirname, '../data/feature-board.db');

// Timestamps are ISO-8601 with milliseconds so they sort correctly as text.
const NOW = `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS ideas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'under_review'
                CHECK (status IN (${STATUSES.map((s) => `'${s}'`).join(', ')})),
    created_at  TEXT NOT NULL DEFAULT ${NOW}
  );

  CREATE TABLE IF NOT EXISTS votes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id    INTEGER NOT NULL REFERENCES ideas (id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    UNIQUE (idea_id, visitor_id)
  );
`;

export function openDb(filename = process.env.DATABASE_PATH || DEFAULT_DATABASE_PATH) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
