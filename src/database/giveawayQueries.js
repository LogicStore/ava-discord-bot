const db = require('./db');

module.exports = {
    create(guildId, channelId, prizes, maxParticipants, requiredRoleId, winnerCount, endsAt, createdBy) {
        return db.prepare(`
            INSERT INTO giveaways (guild_id, channel_id, prizes, max_participants, required_role_id, winner_count, ends_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(guildId, channelId, JSON.stringify(prizes), maxParticipants ?? null, requiredRoleId ?? null, winnerCount, endsAt, createdBy);
    },

    updateMessageId(id, messageId) {
        db.prepare('UPDATE giveaways SET message_id = ? WHERE id = ?').run(messageId, id);
    },

    getById(id) {
        return db.prepare('SELECT * FROM giveaways WHERE id = ?').get(id);
    },

    getActive(guildId) {
        return db.prepare("SELECT * FROM giveaways WHERE guild_id = ? AND status = 'active' ORDER BY ends_at ASC").all(guildId);
    },

    getAllExpired() {
        return db.prepare("SELECT * FROM giveaways WHERE status = 'active' AND ends_at <= ?").all(Math.floor(Date.now() / 1000));
    },

    end(id) {
        db.prepare("UPDATE giveaways SET status = 'ended' WHERE id = ? AND status = 'active'").run(id);
    },

    delete(id) {
        db.prepare("UPDATE giveaways SET status = 'deleted' WHERE id = ?").run(id);
    },

    addEntry(giveawayId, userId) {
        return db.prepare('INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id) VALUES (?, ?)').run(giveawayId, userId);
    },

    removeEntry(giveawayId, userId) {
        return db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(giveawayId, userId);
    },

    hasEntry(giveawayId, userId) {
        return !!db.prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').get(giveawayId, userId);
    },

    getEntries(giveawayId) {
        return db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ?').all(giveawayId);
    },

    getEntryCount(giveawayId) {
        return db.prepare('SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = ?').get(giveawayId).count;
    },
};
