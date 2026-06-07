const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const ticketQueries = require('../../database/ticketQueries');
const { hasStaffPermission } = require('../../components/ticketChannel');
const { sendLog } = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rename')
        .setDescription('Rename the current ticket channel')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('New channel name')
                .setRequired(true)
                .setMaxLength(100)
        ),

    async execute(interaction) {
        const ticket = ticketQueries.getTicketByChannel(interaction.channelId);
        if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', flags: MessageFlags.Ephemeral });

        if (!hasStaffPermission(interaction)) {
            return interaction.reply({ content: 'You do not have permission to rename this ticket.', flags: MessageFlags.Ephemeral });
        }

        const rawName = interaction.options.getString('name');
        const newName = rawName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100);

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await interaction.channel.setName(newName);

        await sendLog(interaction.client, interaction.guildId, [
            `## Ticket Renamed`,
            `**Ticket:** #${ticket.id} — <#${interaction.channelId}>`,
            `**New name:** ${newName}`,
            `**Renamed by:** <@${interaction.user.id}>`,
        ]);

        await interaction.editReply({ content: `Channel renamed to **${newName}**.` });
    },
};
