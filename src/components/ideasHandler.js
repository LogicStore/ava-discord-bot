const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const ideasQueries = require('../database/ideasQueries');
const { buildIdeaEmbed, buildClosePrompt } = require('../utils/ideaEmbed');

async function handleVote(interaction) {
    const isUp = interaction.customId.startsWith('idea_vote_up:');
    const voteType = isUp ? 'up' : 'down';
    const messageId = interaction.customId.split(':')[1];

    const idea = ideasQueries.getIdea(messageId);
    if (!idea) return interaction.reply({ content: 'Idea not found.', flags: MessageFlags.Ephemeral });

    if (idea.status !== 'pending') {
        return interaction.reply({ content: 'This idea is already closed.', flags: MessageFlags.Ephemeral });
    }

    const existing = ideasQueries.getVote(messageId, interaction.user.id);

    if (existing && existing.vote_type === voteType) {
        ideasQueries.removeVote(messageId, interaction.user.id);
    } else {
        ideasQueries.setVote(messageId, interaction.user.id, voteType);
    }

    const { upvotes, downvotes } = ideasQueries.getVoteCounts(messageId);
    await interaction.update(buildIdeaEmbed(idea, upvotes, downvotes));
}

async function handleClose(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
        return interaction.reply({ content: 'You do not have permission to close ideas.', flags: MessageFlags.Ephemeral });
    }

    const messageId = interaction.customId.split(':')[1];
    const idea = ideasQueries.getIdea(messageId);
    if (!idea) return interaction.reply({ content: 'Idea not found.', flags: MessageFlags.Ephemeral });

    if (idea.status !== 'pending') {
        return interaction.reply({ content: 'This idea is already closed.', flags: MessageFlags.Ephemeral });
    }

    const prompt = buildClosePrompt(messageId);
    return interaction.reply({ ...prompt, flags: prompt.flags | MessageFlags.Ephemeral });
}

async function handleDecision(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
        return interaction.reply({ content: 'You do not have permission to close ideas.', flags: MessageFlags.Ephemeral });
    }

    const isAccept = interaction.customId.startsWith('idea_accept:');
    const messageId = interaction.customId.split(':')[1];
    const status = isAccept ? 'accepted' : 'rejected';

    const idea = ideasQueries.getIdea(messageId);
    if (!idea) return interaction.reply({ content: 'Idea not found.', flags: MessageFlags.Ephemeral });

    ideasQueries.updateIdeaStatus(messageId, status);
    const { upvotes, downvotes } = ideasQueries.getVoteCounts(messageId);

    // Edit the original idea message
    try {
        const channel = await interaction.client.channels.fetch(idea.channel_id);
        const message = await channel.messages.fetch(messageId);
        await message.edit(buildIdeaEmbed({ ...idea, status }, upvotes, downvotes));
    } catch {}

    // Update the ephemeral close prompt to confirm
    const label = isAccept ? 'Accepted' : 'Rejected';
    await interaction.update({
        components: [
            new ContainerBuilder()
                .setAccentColor(isAccept ? 0x57F287 : 0xED4245)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`The idea has been marked as **${label}**.`)
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    });
}

module.exports = {
    ids: ['idea_vote_up:*', 'idea_vote_down:*', 'idea_close:*', 'idea_accept:*', 'idea_reject:*'],

    async execute(interaction) {
        const id = interaction.customId;
        if (id.startsWith('idea_vote_up:') || id.startsWith('idea_vote_down:')) return handleVote(interaction);
        if (id.startsWith('idea_close:'))                                         return handleClose(interaction);
        if (id.startsWith('idea_accept:') || id.startsWith('idea_reject:'))       return handleDecision(interaction);
    },
};
