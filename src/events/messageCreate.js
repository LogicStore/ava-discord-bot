const ticketQueries = require('../database/ticketQueries');
const { notify } = require('../utils/dmNotify');

module.exports = {
    name: 'messageCreate',

    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const ticket = ticketQueries.getTicketByChannel(message.channelId);
        if (!ticket || ticket.status !== 'open') return;

        // Only notify if the sender is not the ticket creator
        if (message.author.id === ticket.user_id) return;

        const jumpUrl = `https://discord.com/channels/${message.guild.id}/${message.channelId}`;

        await notify(
            client,
            ticket.user_id,
            `A staff member has replied to your ticket **#${ticket.id}** in **${message.guild.name}**.\n${jumpUrl}`
        );
    },
};
