const db = require('./db');

module.exports = {
    getConfig(guildId) {
        return db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId);
    },

    setConfig(guildId, channelId) {
        db.prepare(`
            INSERT INTO welcome_config (guild_id, channel_id)
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
        `).run(guildId, channelId);
    },
};
