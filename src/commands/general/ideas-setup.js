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
        )
        .addRoleOption(option =>
            option
                .setName('closer_role')
                .setDescription('Role allowed to accept or reject ideas')
                .setRequired(false)
        ),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;

        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const channel    = interaction.options.getChannel('channel');
        const closerRole = interaction.options.getRole('closer_role');

        ideasQueries.setConfig(interaction.guildId, channel.id, closerRole?.id ?? null);

        const roleInfo = closerRole ? ` Moderators: <@&${closerRole.id}>.` : '';
        return interaction.reply({
            content: `Ideas channel configured: <#${channel.id}>.${roleInfo}`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
