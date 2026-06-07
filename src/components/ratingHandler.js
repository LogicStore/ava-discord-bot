const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const ratingQueries = require('../database/ratingQueries');
const { updateRatingEmbed } = require('../utils/ratingEmbed');

const ACCENT = 0x0056CA;

function thankContainer(stars) {
    return new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Thank you for your rating\nYou rated the service **${stars}/5**. Your feedback is appreciated.`
            )
        );
}

async function handleChannelRating(interaction) {
    // rating_close:{ticketId}:{stars}
    const parts = interaction.customId.split(':');
    const ticketId = parseInt(parts[1]);
    const stars = parseInt(parts[2]);

    ratingQueries.addRating(interaction.guildId, ticketId, interaction.user.id, stars);
    await updateRatingEmbed(interaction.client, interaction.guildId);

    await interaction.update({ components: [thankContainer(stars)], flags: MessageFlags.IsComponentsV2 });
    setTimeout(() => interaction.channel.delete('Ticket rated and closed').catch(() => {}), 3000);
}

async function handleDmRating(interaction) {
    // rating_dm:{guildId}:{ticketId}:{stars}
    const parts = interaction.customId.split(':');
    const guildId = parts[1];
    const ticketId = parseInt(parts[2]);
    const stars = parseInt(parts[3]);

    ratingQueries.addRating(guildId, ticketId, interaction.user.id, stars);
    await updateRatingEmbed(interaction.client, guildId);

    await interaction.update({ components: [thankContainer(stars)], flags: MessageFlags.IsComponentsV2 });
}

module.exports = {
    ids: ['rating_close:*', 'rating_dm:*'],

    async execute(interaction) {
        if (interaction.customId.startsWith('rating_close:')) return handleChannelRating(interaction);
        if (interaction.customId.startsWith('rating_dm:'))    return handleDmRating(interaction);
    },
};
