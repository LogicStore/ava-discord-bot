const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const giveawayQueries = require('../database/giveawayQueries');
const { buildEndedEmbed } = require('./giveawayEmbed');
const { sendLog } = require('./logger');

const ACCENT = 0x0056CA;

function pickWinners(entries, count) {
    const arr = [...entries];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, count).map(e => e.user_id);
}

async function endGiveaway(client, giveaway) {
    // Mark ended synchronously first to prevent double-processing
    giveawayQueries.end(giveaway.id);

    const entries = giveawayQueries.getEntries(giveaway.id);
    const entryCount = entries.length;

    // Filter by required role
    let eligible = entries;
    if (giveaway.required_role_id) {
        const filteredIds = [];
        try {
            const guild = await client.guilds.fetch(giveaway.guild_id);
            for (const entry of entries) {
                try {
                    const member = await guild.members.fetch(entry.user_id);
                    if (member.roles.cache.has(giveaway.required_role_id)) filteredIds.push(entry.user_id);
                } catch {}
            }
        } catch {}
        eligible = filteredIds.map(uid => ({ user_id: uid }));
    }

    const winners = pickWinners(eligible, giveaway.winner_count);

    // Edit the giveaway message
    try {
        const channel = await client.channels.fetch(giveaway.channel_id);
        const message = await channel.messages.fetch(giveaway.message_id);
        await message.edit({ components: [buildEndedEmbed(giveaway, winners, entryCount)], flags: MessageFlags.IsComponentsV2 });
    } catch {}

    // DM winners
    const prizes = JSON.parse(giveaway.prizes);
    const prizeList = prizes.map(p => `• ${p}`).join('\n');

    for (const winnerId of winners) {
        try {
            const user = await client.users.fetch(winnerId);
            const guild = await client.guilds.fetch(giveaway.guild_id);
            const dmContainer = new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent([
                        `## You won a giveaway !`,
                        ``,
                        `You have won in **${guild.name}**.`,
                        ``,
                        `**Prizes**`,
                        prizeList,
                        ``,
                        `To claim your reward, please open a support ticket in the server.`,
                    ].join('\n'))
                );
            await user.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 });
        } catch {}
    }

    // Log
    await sendLog(client, giveaway.guild_id, [
        `## Giveaway Ended`,
        `**Prizes:** ${prizes.join(', ')}`,
        `**Winners:** ${winners.length > 0 ? winners.map(w => `<@${w}>`).join(', ') : 'None'}`,
        `**Participants:** ${entryCount}`,
    ], 'giveaway_logs');
}

async function checkGiveaways(client) {
    const expired = giveawayQueries.getAllExpired();
    for (const giveaway of expired) {
        await endGiveaway(client, giveaway);
    }
}

function start(client) {
    checkGiveaways(client);
    setInterval(() => checkGiveaways(client), 30_000);
}

module.exports = { start };
