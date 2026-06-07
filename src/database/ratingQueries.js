const db = require('./db');

module.exports = {
    getConfig(guildId) {
        return db.prepare('SELECT * FROM rating_config WHERE guild_id = ?').get(guildId);
    },

    setConfig(guildId, channelId) {
        db.prepare(`
            INSERT INTO rating_config (guild_id, channel_id)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
        `).run(guildId, channelId);
    },

    addRating(guildId, ticketId, userId, stars, feedback) {
        return db.prepare(`
            INSERT OR IGNORE INTO ratings (guild_id, ticket_id, user_id, rating, feedback)
            VALUES (?, ?, ?, ?, ?)
        `).run(guildId, ticketId, userId, stars, feedback ?? null);
    },

    getStats(guildId) {
        const row = db.prepare('SELECT COUNT(*) as total, AVG(rating) as average FROM ratings WHERE guild_id = ?').get(guildId);
        return { total: row.total || 0, average: row.average || 0 };
    },
};
