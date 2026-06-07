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

db.exec(`
    CREATE TABLE IF NOT EXISTS log_configs (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        log_type   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        UNIQUE(guild_id, log_type)
    );
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS welcome_config (
        guild_id   TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL
    );
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS rating_config (
        guild_id   TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message_id TEXT
    );

    CREATE TABLE IF NOT EXISTS ratings (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        ticket_id  INTEGER NOT NULL,
        user_id    TEXT NOT NULL,
        rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        rated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, ticket_id)
    );
`);

// Migrations
try { db.exec("ALTER TABLE ticket_panels ADD COLUMN staff_roles TEXT NOT NULL DEFAULT '[]'"); } catch {}
try { db.exec("ALTER TABLE tickets ADD COLUMN claimed_by TEXT"); } catch {}
try { db.exec("ALTER TABLE tickets ADD COLUMN closed_by TEXT"); } catch {}
try { db.exec("ALTER TABLE tickets ADD COLUMN close_reason TEXT"); } catch {}
try { db.exec("ALTER TABLE ratings ADD COLUMN feedback TEXT"); } catch {}

module.exports = db;
