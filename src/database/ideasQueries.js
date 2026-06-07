const db = require('./db');

module.exports = {
    getConfig(guildId) {
        return db.prepare('SELECT * FROM ideas_config WHERE guild_id = ?').get(guildId);
    },

    setConfig(guildId, channelId, closerRoleId = null) {
        db.prepare('INSERT OR REPLACE INTO ideas_config (guild_id, channel_id, closer_role_id) VALUES (?, ?, ?)').run(guildId, channelId, closerRoleId);
    },

    createIdea(messageId, guildId, channelId, authorId, authorName, avatarUrl, content) {
        db.prepare(`
            INSERT INTO ideas (message_id, guild_id, channel_id, author_id, author_name, avatar_url, content)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(messageId, guildId, channelId, authorId, authorName, avatarUrl, content);
    },

    getIdea(messageId) {
        return db.prepare('SELECT * FROM ideas WHERE message_id = ?').get(messageId);
    },

    updateIdeaStatus(messageId, status) {
        db.prepare('UPDATE ideas SET status = ? WHERE message_id = ?').run(status, messageId);
    },

    getVote(messageId, userId) {
        return db.prepare('SELECT * FROM idea_votes WHERE message_id = ? AND user_id = ?').get(messageId, userId);
    },

    setVote(messageId, userId, voteType) {
        db.prepare('INSERT OR REPLACE INTO idea_votes (message_id, user_id, vote_type) VALUES (?, ?, ?)').run(messageId, userId, voteType);
    },

    removeVote(messageId, userId) {
        db.prepare('DELETE FROM idea_votes WHERE message_id = ? AND user_id = ?').run(messageId, userId);
    },

    getVoteCounts(messageId) {
        const up   = db.prepare("SELECT COUNT(*) as c FROM idea_votes WHERE message_id = ? AND vote_type = 'up'").get(messageId)?.c ?? 0;
        const down = db.prepare("SELECT COUNT(*) as c FROM idea_votes WHERE message_id = ? AND vote_type = 'down'").get(messageId)?.c ?? 0;
        return { upvotes: up, downvotes: down };
    },
};
