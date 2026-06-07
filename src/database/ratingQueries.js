const db = require('./db');

module.exports = {
    getConfig(guildId) {
        return db.prepare('SELECT * FROM rating_config WHERE guild_id = ?').get(guildId);
    },

    setConfig(guildId, channelId) {
        db.prepare(`
            INSERT INTO rating_config (guild_id, channel_id)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, message_id = NULL
        `).run(guildId, channelId);
    },

    updateMessageId(guildId, messageId) {
        db.prepare('UPDATE rating_config SET message_id = ? WHERE guild_id = ?').run(messageId, guildId);
    },

    addRating(guildId, ticketId, userId, stars) {
        return db.prepare(`
            INSERT OR IGNORE INTO ratings (guild_id, ticket_id, user_id, rating)
            VALUES (?, ?, ?, ?)
        `).run(guildId, ticketId, userId, stars);
    },

    getStats(guildId) {
        const row = db.prepare('SELECT COUNT(*) as total, AVG(rating) as average FROM ratings WHERE guild_id = ?').get(guildId);
        return { total: row.total || 0, average: row.average || 0 };
    },
};
