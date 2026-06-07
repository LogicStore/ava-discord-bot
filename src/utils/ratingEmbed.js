const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');

const ratingQueries = require('../database/ratingQueries');

const ACCENT = 0x0056CA;

function starsText(average, total) {
    if (total === 0) return 'No ratings yet.';
    const filled = Math.round(average);
    return `${'★'.repeat(filled)}${'☆'.repeat(5 - filled)}  **${average.toFixed(1)}/5**\nBased on ${total} rating${total === 1 ? '' : 's'}`;
}

function buildEmbed(average, total) {
    return new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## Service Ratings\nOverall satisfaction across all closed tickets.')
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(starsText(average, total))
        );
}

function buildRatingButtons(ticketId, prefix, guildId = null) {
    const base = guildId ? `${prefix}:${guildId}:${ticketId}` : `${prefix}:${ticketId}`;
    return new ActionRowBuilder().addComponents(
        [1, 2, 3, 4, 5].map(n =>
            new ButtonBuilder()
                .setCustomId(`${base}:${n}`)
                .setLabel(`${n}`)
                .setStyle(ButtonStyle.Secondary)
        )
    );
}

async function updateRatingEmbed(client, guildId) {
    try {
        const config = ratingQueries.getConfig(guildId);
        if (!config?.message_id) return;

        const { average, total } = ratingQueries.getStats(guildId);
        const channel = await client.channels.fetch(config.channel_id);
        const message = await channel.messages.fetch(config.message_id);
        await message.edit({ components: [buildEmbed(average, total)], flags: MessageFlags.IsComponentsV2 });
    } catch {
        // Fail silently
    }
}

module.exports = { buildEmbed, buildRatingButtons, updateRatingEmbed };
