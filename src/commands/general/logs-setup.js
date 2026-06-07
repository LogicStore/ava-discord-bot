const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const logQueries = require('../../database/logQueries');
const { buildMainView } = require('../../components/logsSetup');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('logs-setup')
        .setDescription('Configure the log channels for ticket and giveaway events'),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        const configs = logQueries.getAllLogConfigs(interaction.guildId);
        const { components, flags } = buildMainView(configs);

        await interaction.reply({ components, flags: flags | MessageFlags.Ephemeral });
    },
};
