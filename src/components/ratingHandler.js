const {
    ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle,
    ContainerBuilder, TextDisplayBuilder, MessageFlags,
} = require('discord.js');

const ratingQueries = require('../database/ratingQueries');
const ticketQueries = require('../database/ticketQueries');
const { sendRatingMessage } = require('../utils/ratingEmbed');

const ACCENT = 0x0056CA;

async function handleStarButton(interaction) {
    // rating_close:{ticketId}:{stars}  or  rating_dm:{guildId}:{ticketId}:{stars}
    const parts = interaction.customId.split(':');
    const stars = parts[parts.length - 1];
    const ticketId = parts[parts.length - 2];

    await interaction.showModal(
        new ModalBuilder()
            .setCustomId(`rating_feedback_modal:${ticketId}:${stars}`)
            .setTitle('Leave a Review')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('feedback')
                        .setLabel('Share your experience (optional)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(500)
                        .setPlaceholder('Tell us about your experience...')
                        .setRequired(false)
                )
            )
    );
}

async function handleFeedbackModal(interaction) {
    // rating_feedback_modal:{ticketId}:{stars}
    const [, ticketIdStr, starsStr] = interaction.customId.split(':');
    const ticketId = parseInt(ticketIdStr);
    const stars = parseInt(starsStr);
    const feedback = interaction.fields.getTextInputValue('feedback').trim() || null;

    const ticket = ticketQueries.getTicketById(ticketId);
    if (!ticket) return interaction.reply({ content: 'Ticket not found.', flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId ?? ticket.guild_id;
    const isInChannel = !!interaction.guildId;

    const result = ratingQueries.addRating(guildId, ticketId, interaction.user.id, stars, feedback);

    if (result.changes === 0) {
        return interaction.reply({ content: 'You have already rated this ticket.', flags: MessageFlags.Ephemeral });
    }

    await sendRatingMessage(interaction.client, guildId, ticket, stars, feedback);

    const thankContainer = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Thank you for your rating\nYou rated the service **${stars}/5**. Your feedback has been recorded.`
            )
        );

    await interaction.reply({ components: [thankContainer], flags: MessageFlags.IsComponentsV2 });

    if (isInChannel) {
        setTimeout(() => interaction.channel?.delete('Ticket rated and closed').catch(() => {}), 3000);
    }
}

module.exports = {
    ids: ['rating_close:*', 'rating_dm:*', 'rating_feedback_modal:*'],

    async execute(interaction) {
        const id = interaction.customId;
        if (id.startsWith('rating_close:') || id.startsWith('rating_dm:')) return handleStarButton(interaction);
        if (id.startsWith('rating_feedback_modal:'))                         return handleFeedbackModal(interaction);
    },
};
