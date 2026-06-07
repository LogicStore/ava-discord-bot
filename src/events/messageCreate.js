const ticketQueries = require('../database/ticketQueries');
const ideasQueries = require('../database/ideasQueries');
const { notify } = require('../utils/dmNotify');
const { buildIdeaEmbed } = require('../utils/ideaEmbed');

const MIN_IDEA_LENGTH = 150;

module.exports = {
    name: 'messageCreate',

    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        // Ideas channel handling
        const ideasConfig = ideasQueries.getConfig(message.guild.id);
        if (ideasConfig && message.channelId === ideasConfig.channel_id) {
            await message.delete().catch(() => {});

            const content = message.content.trim();

            if (content.length < MIN_IDEA_LENGTH) {
                const err = await message.channel.send(
                    `<@${message.author.id}> Your suggestion must be at least ${MIN_IDEA_LENGTH} characters. Please describe your idea in more detail (${content.length}/${MIN_IDEA_LENGTH}).`
                );
                setTimeout(() => err.delete().catch(() => {}), 7000);
                return;
            }

            const avatarUrl = message.author.displayAvatarURL({ size: 128 });

            // Send without buttons first (messageId not known yet)
            const tempIdea = { message_id: 'pending', author_name: message.author.username, avatar_url: avatarUrl, content };
            const sent = await message.channel.send(buildIdeaEmbed(tempIdea, 0, 0));

            // Save to DB with the real message ID
            ideasQueries.createIdea(sent.id, message.guild.id, message.channelId, message.author.id, message.author.username, avatarUrl, content);

            // Edit to add functional vote buttons
            const idea = ideasQueries.getIdea(sent.id);
            await sent.edit(buildIdeaEmbed(idea, 0, 0));
            return;
        }

        // Ticket DM notification
        const ticket = ticketQueries.getTicketByChannel(message.channelId);
        if (!ticket || ticket.status !== 'open') return;
        if (message.author.id === ticket.user_id) return;

        const jumpUrl = `https://discord.com/channels/${message.guild.id}/${message.channelId}`;
        await notify(client, ticket.user_id, `A staff member has replied to your ticket **#${ticket.id}** in **${message.guild.name}**.\n${jumpUrl}`);
    },
};
