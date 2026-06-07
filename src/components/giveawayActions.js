const { MessageFlags } = require('discord.js');

const giveawayQueries = require('../database/giveawayQueries');
const { sendLog } = require('../utils/logger');
const {
    buildGiveawayEmbed, buildDeleteListEmbed, buildDeleteConfirmEmbed,
} = require('../utils/giveawayEmbed');

// ─── Enter / Leave ────────────────────────────────────────────────────────────

async function handleEnter(interaction) {
    const giveawayId = parseInt(interaction.customId.split(':')[1]);
    const giveaway = giveawayQueries.getById(giveawayId);

    if (!giveaway || giveaway.status !== 'active') {
        return interaction.reply({ content: 'This giveaway is no longer active.', flags: MessageFlags.Ephemeral });
    }

    // Role check
    if (giveaway.required_role_id && !interaction.member.roles.cache.has(giveaway.required_role_id)) {
        return interaction.reply({
            content: `You need the <@&${giveaway.required_role_id}> role to enter this giveaway.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    const alreadyIn = giveawayQueries.hasEntry(giveawayId, interaction.user.id);

    if (alreadyIn) {
        giveawayQueries.removeEntry(giveawayId, interaction.user.id);
    } else {
        // Max participants check
        if (giveaway.max_participants) {
            const count = giveawayQueries.getEntryCount(giveawayId);
            if (count >= giveaway.max_participants) {
                return interaction.reply({ content: 'This giveaway has reached its maximum number of participants.', flags: MessageFlags.Ephemeral });
            }
        }
        giveawayQueries.addEntry(giveawayId, interaction.user.id);
    }

    await interaction.deferUpdate();

    const newCount = giveawayQueries.getEntryCount(giveawayId);
    await interaction.editReply({ components: [buildGiveawayEmbed(giveaway, newCount)], flags: MessageFlags.IsComponentsV2 });
    await interaction.followUp({
        content: alreadyIn ? 'You have left the giveaway.' : 'You have entered the giveaway!',
        flags: MessageFlags.Ephemeral,
    });
}

// ─── Delete flow ──────────────────────────────────────────────────────────────

async function handleDeleteSelect(interaction) {
    const giveawayId = parseInt(interaction.values[0]);
    const giveaway = giveawayQueries.getById(giveawayId);
    if (!giveaway) return interaction.update({ content: 'Giveaway not found.', components: [], flags: MessageFlags.IsComponentsV2 });
    await interaction.update(buildDeleteConfirmEmbed(giveaway));
}

async function handleDeleteConfirm(interaction) {
    const giveawayId = parseInt(interaction.customId.split(':')[1]);
    const giveaway = giveawayQueries.getById(giveawayId);

    giveawayQueries.delete(giveawayId);

    // Try to delete the Discord message
    try {
        const channel = await interaction.client.channels.fetch(giveaway.channel_id);
        const message = await channel.messages.fetch(giveaway.message_id);
        await message.delete();
    } catch {}

    await sendLog(interaction.client, interaction.guildId, [
        `## Giveaway Deleted`,
        `**ID:** #${giveawayId}`,
        `**Prizes:** ${JSON.parse(giveaway.prizes).join(', ')}`,
        `**Deleted by:** <@${interaction.user.id}>`,
    ], 'giveaway_logs');

    const { ContainerBuilder, TextDisplayBuilder } = require('discord.js');
    const done = new ContainerBuilder()
        .setAccentColor(0x0056CA)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## Giveaway Deleted\nThe giveaway has been removed.')
        );

    await interaction.update({ components: [done], flags: MessageFlags.IsComponentsV2 });
}

async function handleDeleteCancel(interaction) {
    const giveaways = giveawayQueries.getActive(interaction.guildId);
    if (giveaways.length === 0) {
        await interaction.update({ content: 'No active giveaways.', components: [], flags: MessageFlags.IsComponentsV2 });
    } else {
        await interaction.update(buildDeleteListEmbed(giveaways));
    }
}

// ─── Router ───────────────────────────────────────────────────────────────────

module.exports = {
    ids: ['giveaway_enter:*', 'giveaway_delete_select', 'giveaway_delete_confirm:*', 'giveaway_delete_cancel'],

    async execute(interaction) {
        const id = interaction.customId;
        if (id.startsWith('giveaway_enter:'))           return handleEnter(interaction);
        if (id === 'giveaway_delete_select')             return handleDeleteSelect(interaction);
        if (id.startsWith('giveaway_delete_confirm:'))  return handleDeleteConfirm(interaction);
        if (id === 'giveaway_delete_cancel')             return handleDeleteCancel(interaction);
    },
};
