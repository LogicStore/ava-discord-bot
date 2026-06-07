const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');

const COLORS = {
    pending:  0x0056CA,
    accepted: 0x57F287,
    rejected: 0xED4245,
};

const STATUS_LABEL = {
    pending:  '-# Pending',
    accepted: '-# Accepted',
    rejected: '-# Rejected',
};

function buildIdeaEmbed(idea, upvotes, downvotes) {
    const status = idea.status || 'pending';
    const hasId  = idea.message_id && idea.message_id !== 'pending';
    const closed = status !== 'pending';

    const container = new ContainerBuilder()
        .setAccentColor(COLORS[status] ?? COLORS.pending)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent([
                        `## Suggestion by ${idea.author_name}`,
                        STATUS_LABEL[status] ?? STATUS_LABEL.pending,
                        ``,
                        idea.content,
                    ].join('\n'))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(idea.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png')
                )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**Votes**\n✅ ${upvotes} - ❌ ${downvotes}`)
        );

    if (hasId && !closed) {
        container
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`idea_vote_up:${idea.message_id}`)
                        .setLabel(`Approve (${upvotes})`)
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`idea_vote_down:${idea.message_id}`)
                        .setLabel(`Reject (${downvotes})`)
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`idea_close:${idea.message_id}`)
                        .setLabel('Close Idea')
                        .setStyle(ButtonStyle.Secondary),
                )
            );
    }

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildClosePrompt(messageId) {
    return {
        components: [
            new ContainerBuilder()
                .setAccentColor(0x0056CA)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## Close Idea\nHow would you like to close this idea?')
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`idea_accept:${messageId}`)
                            .setLabel('Accept')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`idea_reject:${messageId}`)
                            .setLabel('Reject')
                            .setStyle(ButtonStyle.Danger),
                    )
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

module.exports = { buildIdeaEmbed, buildClosePrompt };
