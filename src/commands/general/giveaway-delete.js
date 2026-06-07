const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const giveawayQueries = require('../../database/giveawayQueries');
const { buildDeleteListEmbed } = require('../../utils/giveawayEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveaway-delete')
        .setDescription('Delete an active giveaway'),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        const giveaways = giveawayQueries.getActive(interaction.guildId);

        if (giveaways.length === 0) {
            return interaction.reply({ content: 'There are no active giveaways.', flags: MessageFlags.Ephemeral });
        }

        const { components, flags } = buildDeleteListEmbed(giveaways);
        await interaction.reply({ components, flags: flags | MessageFlags.Ephemeral });
    },
};
