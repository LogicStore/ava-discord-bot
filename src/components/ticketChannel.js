const {
    ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags,
    PermissionsBitField,
} = require('discord.js');

const ticketQueries = require('../database/ticketQueries');
const { buildWelcomeMessage } = require('./ticketPanel');
const { notify } = require('../utils/dmNotify');
const { sendLog } = require('../utils/logger');
const { buildRatingPrompt } = require('../utils/ratingEmbed');

const ACCENT = 0x0056CA;

function getStaffRoles(channelId) {
    const panel = ticketQueries.getPanelByTicketChannel(channelId);
    return JSON.parse(panel?.staff_roles || '[]');
}

function hasTicketPermission(interaction, ticket) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (adminRoleId && interaction.member.roles.cache.has(adminRoleId)) return true;
    if (ticket.user_id === interaction.user.id) return true;
    const staffRoles = getStaffRoles(interaction.channelId);
    return staffRoles.some(rid => interaction.member.roles.cache.has(rid));
}

function hasStaffPermission(interaction) {
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    if (adminRoleId && interaction.member.roles.cache.has(adminRoleId)) return true;
    const staffRoles = getStaffRoles(interaction.channelId);
    return staffRoles.some(rid => interaction.member.roles.cache.has(rid));
}

async function handleClose(interaction) {
    const ticket = ticketQueries.getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', flags: MessageFlags.Ephemeral });

    await interaction.showModal(
        new ModalBuilder()
            .setCustomId('ticket_close_reason_modal')
            .setTitle('Close Ticket')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel('Reason for closing')
                        .setStyle(TextInputStyle.Paragraph)
                        .setMaxLength(500)
                        .setRequired(true)
                )
            )
    );
}

async function handleCloseReasonModal(interaction) {
    const reason = interaction.fields.getTextInputValue('reason').trim();
    const ticket = ticketQueries.getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ content: 'Ticket not found.', flags: MessageFlags.Ephemeral });

    ticketQueries.closeTicket(interaction.channelId, interaction.user.id, reason);

    await sendLog(interaction.client, interaction.guildId, [
        `## Ticket Closed`,
        `**Ticket:** #${ticket.id}`,
        `**Closed by:** <@${interaction.user.id}>`,
        `**Opened by:** <@${ticket.user_id}>`,
        `**Reason:** ${reason}`,
    ]);

    const isCreator = interaction.user.id === ticket.user_id;

    if (isCreator) {
        await interaction.reply({
            components: [buildRatingPrompt(ticket.id, 'rating_close')],
            flags: MessageFlags.IsComponentsV2,
        });
        setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 120_000);
    } else {
        const closedContainer = new ContainerBuilder()
            .setAccentColor(ACCENT)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## Ticket Closed\nClosed by <@${interaction.user.id}>.\n**Reason:** ${reason}\n-# This channel will be deleted in 5 seconds.`
                )
            );
        await interaction.reply({ components: [closedContainer], flags: MessageFlags.IsComponentsV2 });
        setTimeout(() => interaction.channel.delete('Ticket closed').catch(() => {}), 5000);

        try {
            const user = await interaction.client.users.fetch(ticket.user_id);
            await user.send({
                components: [buildRatingPrompt(ticket.id, 'rating_dm', interaction.guildId)],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch {}
    }
}

async function handleRename(interaction) {
    if (!hasStaffPermission(interaction)) {
        return interaction.reply({ content: 'You do not have permission to rename this ticket.', flags: MessageFlags.Ephemeral });
    }

    await interaction.showModal(
        new ModalBuilder()
            .setCustomId('ticket_modal_rename')
            .setTitle('Rename Ticket')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('new_name')
                        .setLabel('New Channel Name')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('e.g. support-purchase-help')
                        .setMaxLength(100)
                        .setRequired(true)
                )
            )
    );
}

async function handleRenameModal(interaction) {
    const rawName = interaction.fields.getTextInputValue('new_name');
    const newName = rawName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.channel.setName(newName);

    const ticket = ticketQueries.getTicketByChannel(interaction.channelId);
    if (ticket) {
        await sendLog(interaction.client, interaction.guildId, [
            `## Ticket Renamed`,
            `**Ticket:** #${ticket.id} — <#${interaction.channelId}>`,
            `**New name:** ${newName}`,
            `**Renamed by:** <@${interaction.user.id}>`,
        ]);
    }

    await interaction.editReply({ content: `Channel renamed to **${newName}**.` });
}

async function handleClaim(interaction) {
    const ticket = ticketQueries.getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', flags: MessageFlags.Ephemeral });

    if (ticket.claimed_by) {
        return interaction.reply({ content: `This ticket is already claimed by <@${ticket.claimed_by}>.`, flags: MessageFlags.Ephemeral });
    }

    const staffRoles = getStaffRoles(interaction.channelId);
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const canClaim = (adminRoleId && interaction.member.roles.cache.has(adminRoleId)) ||
        staffRoles.some(rid => interaction.member.roles.cache.has(rid));

    if (!canClaim) {
        return interaction.reply({ content: 'You do not have permission to claim this ticket.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferUpdate();

    for (const roleId of staffRoles) {
        await interaction.channel.permissionOverwrites.edit(roleId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
        }).catch(() => {});
    }
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
    }).catch(() => {});

    ticketQueries.claimTicket(interaction.channelId, interaction.user.id);

    await sendLog(interaction.client, interaction.guildId, [
        `## Ticket Claimed`,
        `**Ticket:** #${ticket.id} — <#${interaction.channelId}>`,
        `**Claimed by:** <@${interaction.user.id}>`,
        `**Opened by:** <@${ticket.user_id}>`,
    ]);

    const jumpUrl = `https://discord.com/channels/${interaction.guildId}/${interaction.channelId}`;
    await notify(
        interaction.client,
        ticket.user_id,
        `Your ticket **#${ticket.id}** in **${interaction.guild.name}** has been claimed by **${interaction.user.tag}**.\n${jumpUrl}`
    );

    const category = ticketQueries.getCategoryById(ticket.category_id);
    const updatedContainer = buildWelcomeMessage(ticket.id, category, ticket.subject, ticket.user_id, interaction.user.id);

    await interaction.editReply({ components: [updatedContainer], flags: MessageFlags.IsComponentsV2 });
}

async function handleAddMe(interaction) {
    const ticket = ticketQueries.getTicketByChannel(interaction.channelId);
    if (!ticket) return interaction.reply({ content: 'This channel is not a ticket.', flags: MessageFlags.Ephemeral });

    if (!hasStaffPermission(interaction)) {
        return interaction.reply({ content: 'You do not have permission to join this ticket.', flags: MessageFlags.Ephemeral });
    }

    const existing = interaction.channel.permissionOverwrites.cache.get(interaction.user.id);
    if (existing?.allow.has(PermissionsBitField.Flags.SendMessages)) {
        return interaction.reply({ content: 'You already have access to this ticket.', flags: MessageFlags.Ephemeral });
    }

    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
    });

    await sendLog(interaction.client, interaction.guildId, [
        `## Staff Joined Ticket`,
        `**Ticket:** #${ticket.id} — <#${interaction.channelId}>`,
        `**Staff:** <@${interaction.user.id}>`,
        `**Opened by:** <@${ticket.user_id}>`,
    ]);

    await notify(
        interaction.client,
        ticket.user_id,
        `**${interaction.user.tag}** has joined your ticket **#${ticket.id}** in **${interaction.guild.name}** to assist you.`
    );

    await interaction.reply({ content: `<@${interaction.user.id}> joined this ticket.` });
}

module.exports = {
    ids: ['ticket_close', 'ticket_close_reason_modal', 'ticket_rename', 'ticket_modal_rename', 'ticket_claim', 'ticket_add_me'],

    hasTicketPermission,
    hasStaffPermission,

    async execute(interaction) {
        switch (interaction.customId) {
            case 'ticket_close':              return handleClose(interaction);
            case 'ticket_close_reason_modal': return handleCloseReasonModal(interaction);
            case 'ticket_rename':             return handleRename(interaction);
            case 'ticket_modal_rename':       return handleRenameModal(interaction);
            case 'ticket_claim':              return handleClaim(interaction);
            case 'ticket_add_me':             return handleAddMe(interaction);
        }
    },
};
