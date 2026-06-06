const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const ticketQueries = require('../../database/ticketQueries');
const { hasTicketPermission } = require('../../components/ticketChannel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Close the current ticket'),

    async execute(interaction) {
        const ticket = ticketQueries.getTicketByChannel(interaction.channelId);
        if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', flags: MessageFlags.Ephemeral });

        if (!hasTicketPermission(interaction, ticket)) {
            return interaction.reply({ content: 'You do not have permission to close this ticket.', flags: MessageFlags.Ephemeral });
        }

        ticketQueries.closeTicket(interaction.channelId);

        const container = new ContainerBuilder()
            .setAccentColor(0x0056CA)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## Ticket Closed\nClosed by <@${interaction.user.id}>.\n-# This channel will be deleted in 5 seconds.`
                )
            );

        await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 5000);
    },
};
