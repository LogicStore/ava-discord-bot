const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'ava.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_panels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        message_id  TEXT,
        name        TEXT NOT NULL DEFAULT 'Support Tickets',
        description TEXT NOT NULL DEFAULT 'Open a ticket by selecting a category below.',
        thumbnail   TEXT,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS ticket_categories (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        panel_id            INTEGER NOT NULL,
        guild_id            TEXT NOT NULL,
        name                TEXT NOT NULL,
        description         TEXT,
        emoji               TEXT,
        discord_category_id TEXT,
        FOREIGN KEY (panel_id) REFERENCES ticket_panels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id    TEXT NOT NULL,
        channel_id  TEXT NOT NULL,
        user_id     TEXT NOT NULL,
        category_id INTEGER,
        status      TEXT NOT NULL DEFAULT 'open',
        subject     TEXT,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
        closed_at   INTEGER,
        FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE CASCADE
    );
`);

// Migrations
try { db.exec("ALTER TABLE ticket_panels ADD COLUMN staff_roles TEXT NOT NULL DEFAULT '[]'"); } catch {}
try { db.exec("ALTER TABLE tickets ADD COLUMN claimed_by TEXT"); } catch {}

module.exports = db;
