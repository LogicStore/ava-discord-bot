const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const ratingQueries = require('../../database/ratingQueries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rating-setup')
        .setDescription('Set the channel where rating messages will be sent')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel to receive rating messages')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        const channel = interaction.options.getChannel('channel');
        ratingQueries.setConfig(interaction.guildId, channel.id);

        await interaction.reply({
            content: `Rating messages will now be sent to <#${channel.id}>.`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
