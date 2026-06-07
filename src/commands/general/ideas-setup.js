const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const ideasQueries = require('../../database/ideasQueries');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ideas-setup')
        .setDescription('Configure the ideas channel')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel where community ideas will be posted')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;

        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const channel = interaction.options.getChannel('channel');
        ideasQueries.setConfig(interaction.guildId, channel.id);

        return interaction.reply({
            content: `Ideas channel configured: <#${channel.id}>. Messages sent there will be converted into suggestion posts.`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
