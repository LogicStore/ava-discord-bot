const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check if Ava is online!'),

    async execute(interaction) {
        const latency = Date.now() - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        await interaction.reply({
            content: `Pong! Latency: **${latency}ms** | API: **${apiLatency}ms**`,
        });
    },
};
