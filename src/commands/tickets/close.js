const {
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags,
} = require('discord.js');
const ticketQueries = require('../../database/ticketQueries');
const { hasTicketPermission } = require('../../components/ticketChannel');
const { sendLog } = require('../../utils/logger');
const { buildRatingButtons } = require('../../utils/ratingEmbed');

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

        await sendLog(interaction.client, interaction.guildId, [
            `## Ticket Closed`,
            `**Ticket:** #${ticket.id}`,
            `**Closed by:** <@${interaction.user.id}>`,
            `**Opened by:** <@${ticket.user_id}>`,
        ]);

        const isCreator = interaction.user.id === ticket.user_id;

        if (isCreator) {
            const ratingContainer = new ContainerBuilder()
                .setAccentColor(0x0056CA)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Rate Your Experience\nHow would you rate the service you received? Select a score from 1 to 5.`
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(buildRatingButtons(ticket.id, 'rating_close'));

            await interaction.reply({ components: [ratingContainer], flags: MessageFlags.IsComponentsV2 });
            setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 120_000);
        } else {
            const closedContainer = new ContainerBuilder()
                .setAccentColor(0x0056CA)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Ticket Closed\nClosed by <@${interaction.user.id}>.\n-# This channel will be deleted in 5 seconds.`
                    )
                );

            await interaction.reply({ components: [closedContainer], flags: MessageFlags.IsComponentsV2 });
            setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 5000);

            try {
                const user = await interaction.client.users.fetch(ticket.user_id);
                const dmContainer = new ContainerBuilder()
                    .setAccentColor(0x0056CA)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## Rate Your Experience\nYour ticket **#${ticket.id}** in **${interaction.guild.name}** has been closed. How would you rate the service?`
                        )
                    )
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(buildRatingButtons(ticket.id, 'rating_dm', interaction.guildId));

                await user.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 });
            } catch {}
        }
    },
};
