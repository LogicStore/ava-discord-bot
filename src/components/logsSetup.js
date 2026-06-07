const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, StringSelectMenuBuilder, ChannelSelectMenuBuilder,
    ButtonBuilder, ButtonStyle, ChannelType, MessageFlags,
} = require('discord.js');

const logQueries = require('../database/logQueries');

const ACCENT = 0x0056CA;

const LOG_LABELS = {
    ticket_logs:   'Ticket Logs',
    giveaway_logs: 'Giveaway Logs',
};

function buildMainView(configs) {
    const configMap = Object.fromEntries(configs.map(c => [c.log_type, c.channel_id]));

    const statusLines = Object.entries(LOG_LABELS).map(([type, label]) => {
        const channelId = configMap[type];
        return `**${label}** — ${channelId ? `<#${channelId}>` : '*Not configured*'}`;
    });

    const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## Logs Setup\nConfigure which channel receives each type of log.')
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(statusLines.join('\n'))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('logs_setup_select')
                    .setPlaceholder('Select a log type to configure...')
                    .addOptions(
                        Object.entries(LOG_LABELS).map(([value, label]) => ({ label, value }))
                    )
            )
        );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildChannelView(logType) {
    const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Configure Log Channel\nSelect the channel for **${LOG_LABELS[logType]}**.`
            )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId(`logs_channel_select:${logType}`)
                    .setPlaceholder('Select a text channel...')
                    .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('logs_setup_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary)
            )
        );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function handleLogTypeSelect(interaction) {
    const [logType] = interaction.values;
    await interaction.update(buildChannelView(logType));
}

async function handleChannelSelect(interaction) {
    const logType = interaction.customId.split(':')[1];
    const [channelId] = interaction.values;
    logQueries.setLogConfig(interaction.guildId, logType, channelId);
    const configs = logQueries.getAllLogConfigs(interaction.guildId);
    await interaction.update(buildMainView(configs));
}

async function handleBack(interaction) {
    const configs = logQueries.getAllLogConfigs(interaction.guildId);
    await interaction.update(buildMainView(configs));
}

module.exports = {
    ids: ['logs_setup_select', 'logs_channel_select:*', 'logs_setup_back'],

    buildMainView,

    async execute(interaction) {
        if (interaction.customId === 'logs_setup_select')                return handleLogTypeSelect(interaction);
        if (interaction.customId.startsWith('logs_channel_select:'))     return handleChannelSelect(interaction);
        if (interaction.customId === 'logs_setup_back')                  return handleBack(interaction);
    },
};
