const {
    ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, MessageFlags,
} = require('discord.js');

const ticketQueries = require('../database/ticketQueries');
const { sendLog } = require('../utils/logger');

const ACCENT = 0x0056CA;

async function handleOpenButton(interaction) {
    const catId = parseInt(interaction.customId.split(':')[1]);
    const category = ticketQueries.getCategoryById(catId);
    if (!category) return interaction.reply({ content: 'Category not found.', flags: MessageFlags.Ephemeral });

    await interaction.showModal(
        new ModalBuilder()
            .setCustomId(`ticket_modal_subject:${catId}`)
            .setTitle('Open a Ticket')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('subject')
                        .setLabel('Subject (optional)')
                        .setStyle(TextInputStyle.Short)
                        .setPlaceholder('Brief description of your issue...')
                        .setMaxLength(100)
                        .setRequired(false)
                )
            )
    );
}

async function handleSubjectModal(interaction) {
    const catId = parseInt(interaction.customId.split(':')[1]);
    const category = ticketQueries.getCategoryById(catId);
    if (!category) return interaction.reply({ content: 'Category not found.', flags: MessageFlags.Ephemeral });

    const subject = interaction.fields.getTextInputValue('subject').trim() || null;

    const existing = ticketQueries.getOpenTicketByUser(interaction.guild.id, interaction.user.id);
    if (existing) {
        return interaction.reply({
            content: `You already have an open ticket: <#${existing.channel_id}>`,
            flags: MessageFlags.Ephemeral,
        });
    }

    const panel = ticketQueries.getPanelById(category.panel_id);

    if (panel?.required_role_id && !interaction.member.roles.cache.has(panel.required_role_id)) {
        return interaction.reply({
            content: `You need the <@&${panel.required_role_id}> role to open a ticket.`,
            flags: MessageFlags.Ephemeral,
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    const userId = interaction.user.id;
    const adminRoleId = process.env.ADMIN_ROLE_ID;
    const safeUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';

    const staffRoles = JSON.parse(panel?.staff_roles || '[]');

    const ticketResult = ticketQueries.createTicket(guild.id, userId, catId, subject);
    const ticketId = ticketResult.lastInsertRowid;

    const permOverwrites = [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
            id: userId,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles,
            ],
        },
    ];

    // Admin role: full access always
    if (adminRoleId) {
        permOverwrites.push({
            id: adminRoleId,
            allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.AttachFiles,
            ],
        });
    }

    // Staff roles: can see but NOT write until claimed
    for (const roleId of staffRoles) {
        permOverwrites.push({
            id: roleId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
            deny: [PermissionsBitField.Flags.SendMessages],
        });
    }

    const discordCat = await guild.channels.fetch(category.discord_category_id).catch(() => null);

    const ticketChannel = await guild.channels.create({
        name: `ticket-${ticketId}-${safeUsername}`,
        type: ChannelType.GuildText,
        parent: discordCat?.id,
        permissionOverwrites: permOverwrites,
    });

    ticketQueries.updateTicketChannel(ticketId, ticketChannel.id);

    const welcomeContainer = buildWelcomeMessage(ticketId, category, subject, userId, null);
    await ticketChannel.send({ components: [welcomeContainer], flags: MessageFlags.IsComponentsV2 });

    await sendLog(interaction.client, guild.id, [
        `## Ticket Created`,
        `**Ticket:** #${ticketId} — <#${ticketChannel.id}>`,
        `**Category:** ${category.name}`,
        `**Opened by:** <@${userId}>`,
        subject ? `**Subject:** ${subject}` : '',
    ]);

    await interaction.editReply({ content: `Your ticket has been created: <#${ticketChannel.id}>` });
}

function buildWelcomeMessage(ticketId, category, subject, userId, claimedBy) {
    const lines = [
        `## Ticket #${ticketId}`,
        `**Category:** ${category.name}`,
        subject ? `**Subject:** ${subject}` : '',
        `**Opened by:** <@${userId}>`,
        claimedBy ? `**Claimed by:** <@${claimedBy}>` : '',
    ].filter(Boolean);

    const buttons = [
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('ticket_rename').setLabel('Rename').setStyle(ButtonStyle.Secondary),
    ];

    if (!claimedBy) {
        buttons.push(
            new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Success)
        );
    }

    buttons.push(
        new ButtonBuilder().setCustomId('ticket_add_me').setLabel('Add me').setStyle(ButtonStyle.Secondary)
    );

    return new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                claimedBy
                    ? 'This ticket has been claimed. The staff member will assist you shortly.'
                    : 'A staff member will claim this ticket shortly. Please describe your issue in as much detail as possible.'
            )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
}

module.exports = {
    ids: ['ticket_open:*', 'ticket_modal_subject:*'],

    buildWelcomeMessage,

    async execute(interaction) {
        if (interaction.customId.startsWith('ticket_open:'))          return handleOpenButton(interaction);
        if (interaction.customId.startsWith('ticket_modal_subject:')) return handleSubjectModal(interaction);
    },
};
