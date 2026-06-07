const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const ratingQueries = require('../../database/ratingQueries');
const { buildEmbed } = require('../../utils/ratingEmbed');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rating-setup')
        .setDescription('Set the channel where the rating embed will be displayed')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Channel to post the rating embed in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channel = interaction.options.getChannel('channel');

        // Remove old embed if it exists
        const existing = ratingQueries.getConfig(interaction.guildId);
        if (existing?.message_id) {
            try {
                const prev = await interaction.guild.channels.fetch(existing.channel_id);
                const msg = await prev.messages.fetch(existing.message_id);
                await msg.delete();
            } catch {}
        }

        ratingQueries.setConfig(interaction.guildId, channel.id);

        const { average, total } = ratingQueries.getStats(interaction.guildId);
        const message = await channel.send({ components: [buildEmbed(average, total)], flags: MessageFlags.IsComponentsV2 });

        ratingQueries.updateMessageId(interaction.guildId, message.id);

        await interaction.editReply({ content: `Rating embed posted in <#${channel.id}>.` });
    },
};
