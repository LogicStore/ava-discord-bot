const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('os');

function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Display Ava\'s complete statistics'),

    async execute(interaction) {
        await interaction.deferReply();

        const { client, guild } = interaction;

        await guild.members.fetch();
        await guild.channels.fetch();
        await guild.roles.fetch();

        const memUsed = process.memoryUsage().heapUsed;
        const memTotal = os.totalmem();
        const memFree = os.freemem();
        const cpuModel = os.cpus()[0].model;
        const cpuCount = os.cpus().length;

        const totalMembers = guild.memberCount;
        const botMembers = guild.members.cache.filter(m => m.user.bot).size;
        const humanMembers = totalMembers - botMembers;

        const textChannels = guild.channels.cache.filter(c => c.type === 0).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
        const categories = guild.channels.cache.filter(c => c.type === 4).size;
        const totalChannels = guild.channels.cache.size;

        const totalRoles = guild.roles.cache.size - 1;
        const totalCommands = client.commands.size;

        const embed = new EmbedBuilder()
            .setColor(0x0056CA)
            .setTitle('Ava\'s Statistics')
            .setThumbnail(client.user.displayAvatarURL({ size: 128 }))
            .addFields(
                {
                    name: 'Performance',
                    value: [
                        `> **Uptime** : ${formatUptime(client.uptime)}`,
                        `> **RAM (bot)** : ${formatBytes(memUsed)}`,
                        `> **RAM (system)** : ${formatBytes(memTotal - memFree)} / ${formatBytes(memTotal)}`,
                        `> **CPU** : ${cpuModel} (${cpuCount} cores)`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: 'Network',
                    value: [
                        `> **API Latency** : ${Math.round(client.ws.ping)}ms`,
                        `> **Bot Latency** : ${Date.now() - interaction.createdTimestamp}ms`,
                    ].join('\n'),
                    inline: false,
                },
                {
                    name: 'Members',
                    value: [
                        `> **Total** : ${totalMembers}`,
                        `> **Users** : ${humanMembers}`,
                        `> **Bots** : ${botMembers}`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: 'Channels',
                    value: [
                        `> **Total** : ${totalChannels}`,
                        `> **Text** : ${textChannels}`,
                        `> **Voice** : ${voiceChannels}`,
                        `> **Categories** : ${categories}`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: 'Roles & Commands',
                    value: [
                        `> **Roles** : ${totalRoles}`,
                        `> **Commands** : ${totalCommands}`,
                    ].join('\n'),
                    inline: true,
                },
            )
            .setFooter({ text: `Logic Store • Ava v0.0.1`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
