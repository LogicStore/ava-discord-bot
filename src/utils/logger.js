const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const logQueries = require('../database/logQueries');

async function sendLog(client, guildId, lines, logType = 'ticket_logs') {
    try {
        const config = logQueries.getLogConfig(guildId, logType);
        if (!config) return;

        const channel = await client.channels.fetch(config.channel_id);
        if (!channel) return;

        const timestamp = `<t:${Math.floor(Date.now() / 1000)}:f>`;
        const content = [...lines.filter(Boolean), '', `-# ${timestamp}`].join('\n');

        const container = new ContainerBuilder()
            .setAccentColor(0x0056CA)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

        await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch {
        // Fail silently
    }
}

module.exports = { sendLog };
