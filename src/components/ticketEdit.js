const {
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder,
    ThumbnailBuilder, ActionRowBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags, ChannelType, PermissionsBitField,
} = require('discord.js');

const setupState = require('../state/setupState');
const ticketQueries = require('../database/ticketQueries');
const { buildPanelMessage } = require('./ticketSetup');
const { sendLog } = require('../utils/logger');

const ACCENT = 0x0056CA;

function key(guildId, userId) {
    return `edit:${guildId}:${userId}`;
}

// ─── View builders ────────────────────────────────────────────────────────────

function buildEditMessage(session) {
    const catList = session.categories.length > 0
        ? session.categories.map((c, i) =>
            `${i + 1}. **${c.name}**${c.description ? ` — ${c.description}` : ''}${!c.id ? ' *(new)*' : ''}`
          ).join('\n')
        : '*No categories.*';

    const rolesList = session.staffRoles.length > 0
        ? session.staffRoles.map(id => `<@&${id}>`).join(', ')
        : '*None configured*';

    return {
        components: [
            new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Edit Ticket Panel\n-# Panel #${session.panelId} — <#${session.channelId}>`
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent([
                        `**Name:** ${session.name}`,
                        `**Description:** ${session.description}`,
                        `**Thumbnail:** ${session.thumbnail || '*Not set*'}`,
                        `**Staff Roles:** ${rolesList}`,
                        `**Required Role:** ${session.requiredRoleId ? `<@&${session.requiredRoleId}>` : '*None*'}`,
                        '',
                        '**Categories:**',
                        catList,
                    ].join('\n'))
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('ticket_edit_select')
                            .setPlaceholder('Select an action...')
                            .addOptions([
                                { label: 'Add Category',      value: 'add_category',    description: 'Add a new ticket category' },
                                { label: 'Remove Category',   value: 'remove_category', description: 'Remove an existing category' },
                                { label: 'Panel Info',        value: 'panel_info',      description: 'Edit the panel name and description' },
                                { label: 'Set Thumbnail',     value: 'thumbnail',       description: 'Set the panel thumbnail image URL' },
                                { label: 'Set Required Role', value: 'required_role',   description: 'Role required to open a ticket' },
                            ])
                    )
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('ticket_edit_roles_button')
                            .setLabel('Configure Staff Roles')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('ticket_edit_apply')
                            .setLabel('Apply Changes')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(session.categories.length === 0),
                    )
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

function buildRolesView(session) {
    const rolesList = session.staffRoles.length > 0
        ? session.staffRoles.map(id => `<@&${id}>`).join(', ')
        : '*None configured*';

    return {
        components: [
            new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent([
                        '## Configure Staff Roles',
                        'Select the roles that can claim and respond to tickets.',
                        '',
                        `**Current roles:** ${rolesList}`,
                    ].join('\n'))
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new RoleSelectMenuBuilder()
                            .setCustomId('ticket_edit_roles_select')
                            .setPlaceholder('Select staff roles...')
                            .setMinValues(0)
                            .setMaxValues(10)
                    )
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket_edit_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
                    )
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

function buildRemoveView(session) {
    return {
        components: [
            new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('## Remove Categories\nSelect the categories you want to remove:')
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder()
                            .setCustomId('ticket_edit_remove_cat')
                            .setPlaceholder('Select categories to remove...')
                            .setMinValues(1)
                            .setMaxValues(session.categories.length)
                            .addOptions(
                                session.categories.map((c, i) => ({
                                    label: c.name + (!c.id ? ' (new)' : ''),
                                    value: String(i),
                                    description: c.description || undefined,
                                }))
                            )
                    )
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket_edit_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
                    )
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

function buildRequiredRoleView(session) {
    return {
        components: [
            new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Set Required Role\nMembers need this role to open a ticket.\n\n**Current:** ${session.requiredRoleId ? `<@&${session.requiredRoleId}>` : '*None*'}`
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new RoleSelectMenuBuilder()
                            .setCustomId('ticket_edit_required_role_select')
                            .setPlaceholder('Select a role (leave empty to remove)...')
                            .setMinValues(0)
                            .setMaxValues(1)
                    )
                )
                .addActionRowComponents(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket_edit_back').setLabel('Back').setStyle(ButtonStyle.Secondary)
                    )
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    };
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handlePanelSelect(interaction) {
    const panelId = parseInt(interaction.values[0]);
    const panel = ticketQueries.getPanelById(panelId);
    if (!panel) return interaction.update({ content: 'Panel not found.', flags: MessageFlags.Ephemeral });

    const categories = ticketQueries.getCategoriesByPanel(panelId);
    const sessionKey = key(interaction.guildId, interaction.user.id);

    setupState.set(sessionKey, {
        panelId: panel.id,
        channelId: panel.channel_id,
        messageId: panel.message_id,
        name: panel.name,
        description: panel.description,
        thumbnail: panel.thumbnail,
        staffRoles: JSON.parse(panel.staff_roles || '[]'),
        requiredRoleId: panel.required_role_id,
        categories: categories.map(c => ({
            id: c.id,
            name: c.name,
            description: c.description,
            emoji: c.emoji,
            discord_category_id: c.discord_category_id,
        })),
        removedCategoryIds: [],
    });

    await interaction.update(buildEditMessage(setupState.get(sessionKey)));
}

async function handleEditSelect(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return interaction.update({ content: 'Session expired. Run `/ticket-edit` again.', flags: MessageFlags.Ephemeral });

    const [value] = interaction.values;

    if (value === 'add_category') {
        return interaction.showModal(
            new ModalBuilder()
                .setCustomId('ticket_modal_edit_category')
                .setTitle('Add Ticket Category')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('name').setLabel('Category Name').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('description').setLabel('Description (optional)').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false)
                    )
                )
        );
    }

    if (value === 'remove_category') {
        if (session.categories.length === 0) return interaction.update(buildEditMessage(session));
        return interaction.update(buildRemoveView(session));
    }

    if (value === 'panel_info') {
        return interaction.showModal(
            new ModalBuilder()
                .setCustomId('ticket_modal_edit_info')
                .setTitle('Edit Panel Info')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('name').setLabel('Panel Name').setStyle(TextInputStyle.Short).setValue(session.name).setMaxLength(80).setRequired(true)
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('description').setLabel('Panel Description').setStyle(TextInputStyle.Paragraph).setValue(session.description).setMaxLength(300).setRequired(true)
                    )
                )
        );
    }

    if (value === 'thumbnail') {
        return interaction.showModal(
            new ModalBuilder()
                .setCustomId('ticket_modal_edit_thumbnail')
                .setTitle('Set Thumbnail')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('url').setLabel('Image URL').setStyle(TextInputStyle.Short).setPlaceholder('https://...').setValue(session.thumbnail || '').setMaxLength(500).setRequired(false)
                    )
                )
        );
    }

    if (value === 'required_role') {
        return interaction.update(buildRequiredRoleView(session));
    }
}

async function handleRemoveCat(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;

    const toRemove = new Set(interaction.values.map(Number));
    const kept = [];

    for (let i = 0; i < session.categories.length; i++) {
        if (toRemove.has(i)) {
            if (session.categories[i].id) session.removedCategoryIds.push(session.categories[i].id);
        } else {
            kept.push(session.categories[i]);
        }
    }
    session.categories = kept;
    setupState.set(sessionKey, session);
    await interaction.update(buildEditMessage(session));
}

async function handleBack(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;
    await interaction.update(buildEditMessage(session));
}

async function handleRolesButton(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;
    await interaction.update(buildRolesView(session));
}

async function handleRolesSelect(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;
    session.staffRoles = interaction.values;
    setupState.set(sessionKey, session);
    await interaction.update(buildRolesView(session));
}

async function handleRequiredRoleSelect(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;
    session.requiredRoleId = interaction.values[0] ?? null;
    setupState.set(sessionKey, session);
    await interaction.update(buildEditMessage(session));
}

async function handleApply(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;

    await interaction.deferUpdate();

    const guild = interaction.guild;
    const adminRoleId = process.env.ADMIN_ROLE_ID;

    // 1. Update panel record
    ticketQueries.updatePanel(
        session.panelId, session.name, session.description,
        session.thumbnail, session.staffRoles, session.requiredRoleId
    );

    // 2. Remove deleted categories from DB
    for (const catId of session.removedCategoryIds) {
        ticketQueries.deleteCategoryById(catId);
    }

    // 3. Create Discord categories + DB records for new categories
    const permOverwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }];
    if (adminRoleId) {
        permOverwrites.push({
            id: adminRoleId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels],
        });
    }
    for (const roleId of session.staffRoles) {
        permOverwrites.push({
            id: roleId,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
            deny: [PermissionsBitField.Flags.SendMessages],
        });
    }

    for (const cat of session.categories.filter(c => !c.id)) {
        const discordCat = await guild.channels.create({
            name: cat.name,
            type: ChannelType.GuildCategory,
            permissionOverwrites,
        });
        ticketQueries.addCategory(session.panelId, guild.id, cat.name, cat.description, cat.emoji, discordCat.id);
    }

    // 4. Re-render the panel message in the channel
    const allCategories = ticketQueries.getCategoriesByPanel(session.panelId);
    try {
        const panelContainer = buildPanelMessage(session, allCategories);
        const channel = await guild.channels.fetch(session.channelId);
        const message = await channel.messages.fetch(session.messageId);
        await message.edit({ components: [panelContainer], flags: MessageFlags.IsComponentsV2 });
    } catch {}

    await sendLog(interaction.client, guild.id, [
        `## Panel Updated`,
        `**Name:** ${session.name}`,
        `**Channel:** <#${session.channelId}>`,
        `**Updated by:** <@${interaction.user.id}>`,
    ]);

    setupState.delete(sessionKey);

    await interaction.editReply({
        components: [
            new ContainerBuilder()
                .setAccentColor(ACCENT)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## Changes Applied\nThe ticket panel has been updated in <#${session.channelId}>.`
                    )
                ),
        ],
        flags: MessageFlags.IsComponentsV2,
    });
}

async function handleCategoryModal(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return interaction.reply({ content: 'Session expired. Run `/ticket-edit` again.', flags: MessageFlags.Ephemeral });
    session.categories.push({
        id: null,
        name: interaction.fields.getTextInputValue('name'),
        description: interaction.fields.getTextInputValue('description') || null,
        emoji: null,
        discord_category_id: null,
    });
    setupState.set(sessionKey, session);
    await interaction.update(buildEditMessage(session));
}

async function handleInfoModal(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return interaction.reply({ content: 'Session expired.', flags: MessageFlags.Ephemeral });
    session.name = interaction.fields.getTextInputValue('name');
    session.description = interaction.fields.getTextInputValue('description');
    setupState.set(sessionKey, session);
    await interaction.update(buildEditMessage(session));
}

async function handleThumbnailModal(interaction) {
    const sessionKey = key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return interaction.reply({ content: 'Session expired.', flags: MessageFlags.Ephemeral });
    session.thumbnail = interaction.fields.getTextInputValue('url').trim() || null;
    setupState.set(sessionKey, session);
    await interaction.update(buildEditMessage(session));
}

// ─── Router ───────────────────────────────────────────────────────────────────

module.exports = {
    ids: [
        'ticket_edit_panel_select',
        'ticket_edit_select',
        'ticket_edit_back',
        'ticket_edit_apply',
        'ticket_edit_roles_button',
        'ticket_edit_roles_select',
        'ticket_edit_required_role_select',
        'ticket_edit_remove_cat',
        'ticket_modal_edit_category',
        'ticket_modal_edit_info',
        'ticket_modal_edit_thumbnail',
    ],

    async execute(interaction) {
        switch (interaction.customId) {
            case 'ticket_edit_panel_select':         return handlePanelSelect(interaction);
            case 'ticket_edit_select':               return handleEditSelect(interaction);
            case 'ticket_edit_back':                 return handleBack(interaction);
            case 'ticket_edit_apply':                return handleApply(interaction);
            case 'ticket_edit_roles_button':         return handleRolesButton(interaction);
            case 'ticket_edit_roles_select':         return handleRolesSelect(interaction);
            case 'ticket_edit_required_role_select': return handleRequiredRoleSelect(interaction);
            case 'ticket_edit_remove_cat':           return handleRemoveCat(interaction);
            case 'ticket_modal_edit_category':       return handleCategoryModal(interaction);
            case 'ticket_modal_edit_info':           return handleInfoModal(interaction);
            case 'ticket_modal_edit_thumbnail':      return handleThumbnailModal(interaction);
        }
    },
};
