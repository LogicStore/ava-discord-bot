const db = require('./db');

module.exports = {
    getLogConfig(guildId, logType) {
        return db.prepare('SELECT * FROM log_configs WHERE guild_id = ? AND log_type = ?').get(guildId, logType);
    },

    getAllLogConfigs(guildId) {
        return db.prepare('SELECT * FROM log_configs WHERE guild_id = ?').all(guildId);
    },

    setLogConfig(guildId, logType, channelId) {
        db.prepare(`
            INSERT INTO log_configs (guild_id, log_type, channel_id) VALUES (?, ?, ?)
            ON CONFLICT(guild_id, log_type) DO UPDATE SET channel_id = excluded.channel_id
        `).run(guildId, logType, channelId);
    },
};
