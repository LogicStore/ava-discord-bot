const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, ChannelSelectMenuBuilder,
    ChannelType, MessageFlags,
} = require('discord.js');

const logQueries = require('../database/logQueries');

const ACCENT = 0x0056CA;
const LOG_CHANNEL = 'ticket_logs';

function buildMainView(config) {
    const channelLine = config
        ? `**Current channel:** <#${config.channel_id}>`
        : `**Current channel:** *Not configured*`;

    const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Logs Setup\nAll ticket events will be sent to a single log channel.\n\n${channelLine}`
            )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('logs_channel_select')
                    .setPlaceholder('Select a log channel...')
                    .addChannelTypes(ChannelType.GuildText)
            )
        );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function handleChannelSelect(interaction) {
    const [channelId] = interaction.values;
    logQueries.setLogConfig(interaction.guildId, LOG_CHANNEL, channelId);
    const config = logQueries.getLogConfig(interaction.guildId, LOG_CHANNEL);
    await interaction.update(buildMainView(config));
}

module.exports = {
    ids: ['logs_channel_select'],

    buildMainView,

    async execute(interaction) {
        if (interaction.customId === 'logs_channel_select') return handleChannelSelect(interaction);
    },
};
