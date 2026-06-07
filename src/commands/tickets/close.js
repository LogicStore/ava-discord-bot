const {
    SlashCommandBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, MessageFlags,
} = require('discord.js');
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

        await interaction.showModal(
            new ModalBuilder()
                .setCustomId('ticket_close_reason_modal')
                .setTitle('Close Ticket')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('reason')
                            .setLabel('Reason for closing')
                            .setStyle(TextInputStyle.Paragraph)
                            .setMaxLength(500)
                            .setRequired(true)
                    )
                )
        );
    },
};
