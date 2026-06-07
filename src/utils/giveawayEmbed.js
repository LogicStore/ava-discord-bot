const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    StringSelectMenuBuilder, MessageFlags,
} = require('discord.js');

const THUMBNAIL = 'https://imagedelivery.net/a01l0g2PBuSyl01US7o1cQ/b74c4e2f-a31d-400a-ec74-10eb71ce2b00/public';

const ACCENT = 0x0056CA;

function formatDuration(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 3600) { const m = Math.floor(s / 60); return `${m} minute${m !== 1 ? 's' : ''}`; }
    if (s < 86400) { const h = Math.floor(s / 3600); return `${h} hour${h !== 1 ? 's' : ''}`; }
    const d = Math.floor(s / 86400);
    return `${d} day${d !== 1 ? 's' : ''}`;
}

function parseDuration(input) {
    const match = input.trim().match(/^(\d+)\s*(m|h|d)$/i);
    if (!match) return null;
    const [, n, unit] = match;
    const num = parseInt(n);
    if (num <= 0) return null;
    const mult = { m: 60_000, h: 3_600_000, d: 86_400_000 };
    const ms = num * mult[unit.toLowerCase()];
    if (ms > 30 * 86_400_000) return null;
    return ms;
}

function buildSetupEmbed(session) {
    const prizeList = session.prizes.length > 0
        ? session.prizes.map(p => `• ${p}`).join('\n')
        : '*None added yet*';

    const details = [
        `**Duration:** ${session.durationMs ? formatDuration(session.durationMs) : '*Not set*'}`,
        `**Prizes:**\n${prizeList}`,
        `**Max Participants:** ${session.maxParticipants ?? '*No limit*'}`,
        `**Required Role:** ${session.requiredRoleId ? `<@&${session.requiredRoleId}>` : '*None*'}`,
        `**Winners:** ${session.winnerCount}`,
    ].join('\n\n');

    const canCreate = session.durationMs !== null && session.prizes.length > 0;

    const options = [
        { label: 'Set Duration', value: 'set_duration', description: 'e.g. 30m, 12h, 7d' },
        { label: 'Add Prize', value: 'add_prize', description: 'Add a prize to win' },
        ...(session.prizes.length > 0 ? [{ label: 'Remove Prize', value: 'remove_prize', description: 'Remove an existing prize' }] : []),
        { label: 'Set Max Participants', value: 'set_max', description: 'Limit how many can enter' },
        { label: 'Set Required Role', value: 'set_role', description: 'Role needed to participate' },
        { label: 'Set Winner Count', value: 'set_winners', description: 'How many winners to draw' },
    ];

    return {
        components: [
            new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## Giveaway Setup\n-# Posting to <#${session.targetChannelId}>`)
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(details))
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('giveaway_setup_select')
                            .setPlaceholder('Configure your giveaway...')
                            .addOptions(options)
                    )
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('giveaway_setup_create')
                            .setLabel('Create Giveaway')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(!canCreate)
                    )
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

function buildGiveawayEmbed(giveaway, entryCount) {
    const prizes = JSON.parse(giveaway.prizes);
    const lines = [
        `## Giveaway`,
        ``,
        `**Prizes**`,
        prizes.map(p => `• ${p}`).join('\n'),
        ``,
        giveaway.required_role_id ? `**Required Role** — <@&${giveaway.required_role_id}>` : null,
        `**Participants** — ${entryCount}${giveaway.max_participants ? ` / ${giveaway.max_participants}` : ''}`,
        `**Winners** — ${giveaway.winner_count}`,
        ``,
        `Ends <t:${giveaway.ends_at}:R>`,
    ].filter(l => l !== null).join('\n');

    return new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(THUMBNAIL))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`giveaway_enter:${giveaway.id}`)
                    .setLabel('Enter Giveaway')
                    .setStyle(ButtonStyle.Primary)
            )
        );
}

function buildEndedEmbed(giveaway, winners, entryCount) {
    const prizes = JSON.parse(giveaway.prizes);
    const winnerList = winners.length > 0
        ? winners.map(u => `• <@${u}>`).join('\n')
        : '• No valid participants.';

    const lines = [
        `## Giveaway — Ended`,
        ``,
        `**Prize(s)**`,
        prizes.map(p => `• ${p}`).join('\n'),
        ``,
        `**Winner(s)**`,
        winnerList,
        ``,
        `-# ${entryCount} participant${entryCount !== 1 ? 's' : ''} total`,
    ].join('\n');

    return new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
}

function buildDeleteListEmbed(giveaways) {
    const options = giveaways.map(g => {
        const prizes = JSON.parse(g.prizes);
        return {
            label: prizes.slice(0, 2).join(', ').slice(0, 100) || `Giveaway #${g.id}`,
            description: `Ends <t:${g.ends_at}:R> — ${prizes.length} prize(s)`,
            value: String(g.id),
        };
    });

    return {
        components: [
            new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## Delete Giveaway\nSelect a giveaway to delete:')
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('giveaway_delete_select')
                            .setPlaceholder('Select a giveaway...')
                            .addOptions(options)
                    )
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

function buildDeleteConfirmEmbed(giveaway) {
    const prizes = JSON.parse(giveaway.prizes);
    return {
        components: [
            new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent([
                        `## Confirm Deletion`,
                        `Are you sure you want to delete this giveaway?`,
                        ``,
                        `**Prizes:** ${prizes.join(', ')}`,
                        `**Ends:** <t:${giveaway.ends_at}:R>`,
                    ].join('\n'))
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`giveaway_delete_confirm:${giveaway.id}`)
                            .setLabel('Delete')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('giveaway_delete_cancel')
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Secondary)
                    )
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

module.exports = {
    formatDuration,
    parseDuration,
    buildSetupEmbed,
    buildGiveawayEmbed,
    buildEndedEmbed,
    buildDeleteListEmbed,
    buildDeleteConfirmEmbed,
};
