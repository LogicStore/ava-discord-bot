const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const welcomeQueries = require('../../database/welcomeQueries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('welcome-setup')
        .setDescription('Set the channel where welcome messages will be sent')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel to send welcome messages in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        const channel = interaction.options.getChannel('channel');
        welcomeQueries.setConfig(interaction.guildId, channel.id);

        await interaction.reply({
            content: `Welcome messages will now be sent to <#${channel.id}>.`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
