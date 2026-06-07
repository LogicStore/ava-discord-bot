const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const setupState = require('../../state/setupState');
const { buildSetupEmbed } = require('../../utils/giveawayEmbed');

const stateKey = (guildId, userId) => `gw:${guildId}:${userId}`;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-create')
        .setDescription('Create a new giveaway')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel where the giveaway will be posted')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        const channel = interaction.options.getChannel('channel');

        const key = stateKey(interaction.guildId, interaction.user.id);
        setupState.set(key, {
            targetChannelId: channel.id,
            prizes: [],
            maxParticipants: null,
            requiredRoleId: null,
            winnerCount: 1,
            durationMs: null,
        });

        const { components, flags } = buildSetupEmbed(setupState.get(key));
        await interaction.reply({ components, flags: flags | MessageFlags.Ephemeral });
    },
};
