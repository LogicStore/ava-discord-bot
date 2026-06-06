const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Vérifie si Ava est bien en ligne !'),

    async execute(interaction) {
        const latency = Date.now() - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);

        await interaction.reply({
            content: `Pong ! 🏓 Latence : **${latency}ms** | API : **${apiLatency}ms**`,
            ephemeral: false,
        });
    },
};