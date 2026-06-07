const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags,
} = require('discord.js');

const welcomeQueries = require('../database/welcomeQueries');

const ACCENT = 0x0056CA;

module.exports = {
    name: 'guildMemberAdd',

    async execute(member, client) {
        try {
            const config = welcomeQueries.getConfig(member.guild.id);
            if (!config) return;

            const channel = await client.channels.fetch(config.channel_id).catch(() => null);
            if (!channel) return;

            const memberCount = member.guild.memberCount;

            const container = new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Welcome to ${member.guild.name} !`
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        [
                            `Hey <@${member.id}>, welcome to the server !`,
                            ``,
                            `Browse our available scripts, open a support ticket if you need help, and make yourself at home.`,
                        ].join('\n')
                    )
                );

            await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch {
            // Fail silently
        }
    },
};
