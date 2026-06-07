const db = require('./db');

module.exports = {
    createPanel(guildId, channelId, name, description, thumbnail, staffRoles, requiredRoleId) {
        return db.prepare(`
            INSERT INTO ticket_panels (guild_id, channel_id, name, description, thumbnail, staff_roles, required_role_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(guildId, channelId, name, description, thumbnail, JSON.stringify(staffRoles || []), requiredRoleId ?? null);
    },

    updatePanelMessageId(panelId, messageId) {
        db.prepare('UPDATE ticket_panels SET message_id = ? WHERE id = ?').run(messageId, panelId);
    },

    getAllPanels(guildId) {
        return db.prepare('SELECT * FROM ticket_panels WHERE guild_id = ?').all(guildId);
    },

    getPanelById(id) {
        return db.prepare('SELECT * FROM ticket_panels WHERE id = ?').get(id);
    },

    deleteTicketsByPanel(panelId) {
        db.prepare(`
            DELETE FROM tickets WHERE category_id IN (
                SELECT id FROM ticket_categories WHERE panel_id = ?
            )
        `).run(panelId);
    },

    deletePanel(panelId) {
        db.prepare('DELETE FROM ticket_panels WHERE id = ?').run(panelId);
    },

    addCategory(panelId, guildId, name, description, emoji, discordCategoryId) {
        return db.prepare(`
            INSERT INTO ticket_categories (panel_id, guild_id, name, description, emoji, discord_category_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(panelId, guildId, name, description, emoji, discordCategoryId);
    },

    getCategoryById(id) {
        return db.prepare('SELECT * FROM ticket_categories WHERE id = ?').get(id);
    },

    getCategoriesByPanel(panelId) {
        return db.prepare('SELECT * FROM ticket_categories WHERE panel_id = ?').all(panelId);
    },

    createTicket(guildId, userId, categoryId, subject) {
        return db.prepare(`
            INSERT INTO tickets (guild_id, channel_id, user_id, category_id, subject)
            VALUES (?, 'pending', ?, ?, ?)
        `).run(guildId, userId, categoryId, subject);
    },

    updateTicketChannel(ticketId, channelId) {
        db.prepare('UPDATE tickets SET channel_id = ? WHERE id = ?').run(channelId, ticketId);
    },

    getTicketByChannel(channelId) {
        return db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId);
    },

    getOpenTicketsByCategory(categoryId) {
        return db.prepare("SELECT * FROM tickets WHERE category_id = ? AND status = 'open'").all(categoryId);
    },

    closeTicket(channelId, closedBy, reason) {
        db.prepare(`
            UPDATE tickets SET status = 'closed', closed_at = unixepoch(), closed_by = ?, close_reason = ?
            WHERE channel_id = ?
        `).run(closedBy, reason, channelId);
    },

    getTicketById(id) {
        return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    },

    getPanelByTicketId(ticketId) {
        return db.prepare(`
            SELECT tp.* FROM ticket_panels tp
            JOIN ticket_categories tc ON tc.panel_id = tp.id
            JOIN tickets t ON t.category_id = tc.id
            WHERE t.id = ?
        `).get(ticketId);
    },

    claimTicket(channelId, userId) {
        db.prepare('UPDATE tickets SET claimed_by = ? WHERE channel_id = ?').run(userId, channelId);
    },

    getOpenTicketByUser(guildId, userId) {
        return db.prepare("SELECT * FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(guildId, userId);
    },

    getPanelByTicketChannel(channelId) {
        return db.prepare(`
            SELECT tp.* FROM ticket_panels tp
            JOIN ticket_categories tc ON tc.panel_id = tp.id
            JOIN tickets t ON t.category_id = tc.id
            WHERE t.channel_id = ?
        `).get(channelId);
    },
};
