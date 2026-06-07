const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');

const ratingQueries = require('../database/ratingQueries');
const ticketQueries = require('../database/ticketQueries');

const ACCENT = 0x0056CA;

function buildRatingPrompt(ticketId, prefix, guildId = null) {
    const base = guildId ? `${prefix}:${guildId}:${ticketId}` : `${prefix}:${ticketId}`;
    return new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Rate Your Experience\nHow would you rate the service you received? Select a score from 1 to 5.`
            )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                [1, 2, 3, 4, 5].map(n =>
                    new ButtonBuilder()
                        .setCustomId(`${base}:${n}`)
                        .setLabel(String(n))
                        .setStyle(ButtonStyle.Secondary)
                )
            )
        );
}

async function sendRatingMessage(client, guildId, ticket, stars, feedback) {
    try {
        const config = ratingQueries.getConfig(guildId);
        if (!config) return;

        const channel = await client.channels.fetch(config.channel_id);
        if (!channel) return;

        const panel = ticketQueries.getPanelByTicketId(ticket.id);
        const starsDisplay = '⭐'.repeat(stars);

        const lines = [
            `## New Rating`,
            `<@${ticket.user_id}> has submitted a rating for their ticket experience!`,
            ``,
            `**Ticket Information**`,
            `• Open Date: <t:${ticket.created_at}:f>`,
            `• Panel: ${panel?.name ?? 'Unknown'}`,
            ticket.subject ? `• Subject: ${ticket.subject}` : null,
            ``,
            `**Rating**`,
            `• ${starsDisplay} (${stars}/5)`,
            feedback ? `• "${feedback}"` : null,
            ``,
            `**Close Information**`,
            `• Closed By: <@${ticket.closed_by}>`,
            `• Close Date: <t:${ticket.closed_at}:f>`,
            `• Reason: ${ticket.close_reason ?? 'No reason provided'}`,
        ].filter(l => l !== null).join('\n');

        const container = new ContainerBuilder()
            .setAccentColor(ACCENT)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));

        await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch {
        // Fail silently
    }
}

module.exports = { buildRatingPrompt, sendRatingMessage };
