const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const ticketQueries = require('../../database/ticketQueries');
const { buildPanelSelectMessage } = require('../../components/ticketAdmin');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-delete')
        .setDescription('Delete a ticket panel and all associated data'),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        const panels = ticketQueries.getAllPanels(interaction.guildId);
        if (panels.length === 0) {
            return interaction.reply({ content: 'No ticket panels found on this server.', flags: MessageFlags.Ephemeral });
        }

        const { components, flags } = buildPanelSelectMessage(panels);
        await interaction.reply({ components, flags: flags | MessageFlags.Ephemeral });
    },
};
