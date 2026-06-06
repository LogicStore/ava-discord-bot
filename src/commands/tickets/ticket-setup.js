const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const { buildSetupMessage } = require('../../components/ticketSetup');
const setupState = require('../../state/setupState');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Configure and publish a ticket panel')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel where the ticket panel will be published')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;

        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({
                content: '❌ You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const targetChannel = interaction.options.getChannel('channel');
        const sessionKey = setupState.key(interaction.guildId, interaction.user.id);

        setupState.set(sessionKey, {
            targetChannelId: targetChannel.id,
            name: 'Support Tickets',
            description: 'Open a ticket by selecting a category below.',
            thumbnail: null,
            staffRoles: [],
            categories: [],
        });

        const { components, flags } = buildSetupMessage(setupState.get(sessionKey));

        await interaction.reply({
            components,
            flags: flags | MessageFlags.Ephemeral,
        });
    },
};
