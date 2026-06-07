const {
    ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    StringSelectMenuBuilder, RoleSelectMenuBuilder,
    ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');

const setupState = require('../state/setupState');
const giveawayQueries = require('../database/giveawayQueries');
const { sendLog } = require('../utils/logger');
const {
    parseDuration, formatDuration,
    buildSetupEmbed, buildGiveawayEmbed,
} = require('../utils/giveawayEmbed');

const ACCENT = 0x0056CA;
const MAX_PRIZES = 10;

function stateKey(guildId, userId) { return `gw:${guildId}:${userId}`; }

// ─── Setup select router ──────────────────────────────────────────────────────

async function handleSetupSelect(interaction) {
    const key = stateKey(interaction.guildId, interaction.user.id);
    const session = setupState.get(key);
    if (!session) return interaction.update({ content: 'Session expired. Run `/giveaway-create` again.', components: [], flags: MessageFlags.IsComponentsV2 });

    const [value] = interaction.values;

    if (value === 'set_duration') {
        return interaction.showModal(
            new ModalBuilder()
                .setCustomId('giveaway_duration_modal')
                .setTitle('Set Duration')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('duration')
                            .setLabel('Duration')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. 30m, 12h, 7d')
                            .setRequired(true)
                    )
                )
        );
    }

    if (value === 'add_prize') {
        if (session.prizes.length >= MAX_PRIZES) {
            return interaction.reply({ content: `You can add up to ${MAX_PRIZES} prizes.`, flags: MessageFlags.Ephemeral });
        }
        return interaction.showModal(
            new ModalBuilder()
                .setCustomId('giveaway_prize_modal')
                .setTitle('Add Prize')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('prize')
                            .setLabel('Prize')
                            .setStyle(TextInputStyle.Short)
                            .setMaxLength(200)
                            .setRequired(true)
                    )
                )
        );
    }

    if (value === 'remove_prize') {
        const options = session.prizes.map((p, i) => ({ label: p.slice(0, 100), value: String(i) }));
        return interaction.update({
            components: [
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Remove Prize\nSelect the prize to remove:'))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('giveaway_remove_select')
                                .setPlaceholder('Select a prize...')
                                .addOptions(options)
                        )
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('giveaway_setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    }

    if (value === 'set_max') {
        return interaction.showModal(
            new ModalBuilder()
                .setCustomId('giveaway_max_modal')
                .setTitle('Set Max Participants')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('max')
                            .setLabel('Max Participants (leave blank to remove limit)')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. 100')
                            .setRequired(false)
                    )
                )
        );
    }

    if (value === 'set_role') {
        return interaction.update({
            components: [
                new ContainerBuilder()
                    .setAccentColor(ACCENT)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## Set Required Role\nSelect the role members need to enter this giveaway:'))
                    .addSeparatorComponents(new SeparatorBuilder())
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new RoleSelectMenuBuilder()
                                .setCustomId('giveaway_role_select')
                                .setPlaceholder('Select a role...')
                                .setMinValues(0)
                                .setMaxValues(1)
                        )
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('giveaway_setup_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
                        )
                    ),
            ],
            flags: MessageFlags.IsComponentsV2,
        });
    }

    if (value === 'set_winners') {
        return interaction.showModal(
            new ModalBuilder()
                .setCustomId('giveaway_winners_modal')
                .setTitle('Set Winner Count')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('count')
                            .setLabel('Number of winners')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('e.g. 1')
                            .setRequired(true)
                    )
                )
        );
    }
}

// ─── Modal handlers ───────────────────────────────────────────────────────────

async function handleDurationModal(interaction) {
    const key = stateKey(interaction.guildId, interaction.user.id);
    const session = setupState.get(key);
    if (!session) return interaction.reply({ content: 'Session expired.', flags: MessageFlags.Ephemeral });

    const ms = parseDuration(interaction.fields.getTextInputValue('duration'));
    if (!ms) {
        return interaction.reply({ content: 'Invalid duration. Use format like `30m`, `12h`, `7d` (max 30d).', flags: MessageFlags.Ephemeral });
    }

    session.durationMs = ms;
    setupState.set(key, session);
    await interaction.update(buildSetupEmbed(session));
}

async function handlePrizeModal(interaction) {
    const key = stateKey(interaction.guildId, interaction.user.id);
    const session = setupState.get(key);
    if (!session) return interaction.reply({ content: 'Session expired.', flags: MessageFlags.Ephemeral });

    const prize = interaction.fields.getTextInputValue('prize').trim();
    session.prizes.push(prize);
    setupState.set(key, session);
    await interaction.update(buildSetupEmbed(session));
}

async function handleMaxModal(interaction) {
    const key = stateKey(interaction.guildId, interaction.user.id);
    const session = setupState.get(key);
    if (!session) return interaction.reply({ content: 'Session expired.', flags: MessageFlags.Ephemeral });

    const raw = interaction.fields.getTextInputValue('max').trim();
    if (!raw) {
        session.maxParticipants = null;
    } else {
        const n = parseInt(raw);
        if (isNaN(n) || n < 1) return interaction.reply({ content: 'Enter a valid number greater than 0.', flags: MessageFlags.Ephemeral });
        session.maxParticipants = n;
    }
    setupState.set(key, session);
    await interaction.update(buildSetupEmbed(session));
}

async function handleWinnersModal(interaction) {
    const key = stateKey(interaction.guildId, interaction.user.id);
    const session = setupState.get(key);
    if (!session) return interaction.reply({ content: 'Session expired.', flags: MessageFlags.Ephemeral });

    const n = parseInt(interaction.fields.getTextInputValue('count'));
    if (isNaN(n) || n < 1 || n > 20) return interaction.reply({ content: 'Enter a number between 1 and 20.', flags: MessageFlags.Ephemeral });

    session.winnerCount = n;
    setupState.set(key, session);
    await interaction.update(buildSetupEmbed(session));
}

// ─── Select handlers ──────────────────────────────────────────────────────────

async function handleRemoveSelect(interaction) {
    const key = stateKey(interaction.guildId, interaction.user.id);
    const session = setupState.get(key);
    if (!session) return;
    session.prizes.splice(parseInt(interaction.values[0]), 1);
    setupState.set(key, session);
    await interaction.update(buildSetupEmbed(session));
}

async function handleRoleSelect(interaction) {
    const key = stateKey(interaction.guildId, interaction.user.id);
    const session = setupState.get(key);
    if (!session) return;
    session.requiredRoleId = interaction.values[0] ?? null;
    setupState.set(key, session);
    await interaction.update(buildSetupEmbed(session));
}

async function handleBack(interaction) {
    const key = stateKey(interaction.guildId, interaction.user.id);
    const session = setupState.get(key);
    if (!session) return;
    await interaction.update(buildSetupEmbed(session));
}

// ─── Create ───────────────────────────────────────────────────────────────────

async function handleCreate(interaction) {
    const key = stateKey(interaction.guildId, interaction.user.id);
    const session = setupState.get(key);
    if (!session) return;

    await interaction.deferUpdate();

    const endsAt = Math.floor((Date.now() + session.durationMs) / 1000);

    const result = giveawayQueries.create(
        interaction.guildId,
        session.targetChannelId,
        session.prizes,
        session.maxParticipants,
        session.requiredRoleId,
        session.winnerCount,
        endsAt,
        interaction.user.id
    );
    const giveawayId = result.lastInsertRowid;

    const giveaway = giveawayQueries.getById(giveawayId);
    const channel = await interaction.guild.channels.fetch(session.targetChannelId);
    const message = await channel.send({ components: [buildGiveawayEmbed(giveaway, 0)], flags: MessageFlags.IsComponentsV2 });

    giveawayQueries.updateMessageId(giveawayId, message.id);
    setupState.delete(key);

    await sendLog(interaction.client, interaction.guildId, [
        `## Giveaway Created`,
        `**Prizes:** ${session.prizes.join(', ')}`,
        `**Channel:** <#${session.targetChannelId}>`,
        `**Duration:** ${formatDuration(session.durationMs)}`,
        `**Winners:** ${session.winnerCount}`,
        `**Created by:** <@${interaction.user.id}>`,
    ], 'giveaway_logs');

    const successContainer = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## Giveaway Created\nYour giveaway has been posted in <#${session.targetChannelId}>.`)
        );

    await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
}

// ─── Router ───────────────────────────────────────────────────────────────────

module.exports = {
    ids: [
        'giveaway_setup_select',
        'giveaway_setup_back',
        'giveaway_setup_create',
        'giveaway_role_select',
        'giveaway_remove_select',
        'giveaway_duration_modal',
        'giveaway_prize_modal',
        'giveaway_max_modal',
        'giveaway_winners_modal',
    ],

    async execute(interaction) {
        switch (interaction.customId) {
            case 'giveaway_setup_select':   return handleSetupSelect(interaction);
            case 'giveaway_setup_back':     return handleBack(interaction);
            case 'giveaway_setup_create':   return handleCreate(interaction);
            case 'giveaway_role_select':    return handleRoleSelect(interaction);
            case 'giveaway_remove_select':  return handleRemoveSelect(interaction);
            case 'giveaway_duration_modal': return handleDurationModal(interaction);
            case 'giveaway_prize_modal':    return handlePrizeModal(interaction);
            case 'giveaway_max_modal':      return handleMaxModal(interaction);
            case 'giveaway_winners_modal':  return handleWinnersModal(interaction);
        }
    },
};
