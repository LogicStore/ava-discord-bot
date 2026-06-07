const {
    ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder,
    ThumbnailBuilder, ActionRowBuilder, StringSelectMenuBuilder, RoleSelectMenuBuilder,
    ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags, ChannelType, PermissionsBitField,
} = require('discord.js');

const setupState = require('../state/setupState');
const ticketQueries = require('../database/ticketQueries');
const { sendLog } = require('../utils/logger');

const ACCENT = 0x0056CA;

// ─── Message builders ────────────────────────────────────────────────────────

function buildSetupMessage(session) {
    const catList = session.categories.length > 0
        ? session.categories.map((c, i) => `${i + 1}. **${c.name}**${c.description ? ` — ${c.description}` : ''}`).join('\n')
        : '*No categories configured yet.*';

    const rolesList = session.staffRoles.length > 0
        ? session.staffRoles.map(id => `<@&${id}>`).join(', ')
        : '*None configured*';

    const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Ticket Panel Setup\n-# Publishing to <#${session.targetChannelId}>`
            )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent([
                `**Name:** ${session.name}`,
                `**Description:** ${session.description}`,
                `**Thumbnail:** ${session.thumbnail || '*Not set*'}`,
                `**Staff Roles:** ${rolesList}`,
                '',
                '**Categories:**',
                catList,
            ].join('\n'))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_setup_select')
                    .setPlaceholder('Select an action to configure...')
                    .addOptions([
                        { label: 'Add Category',    value: 'add_category',    description: 'Add a new ticket category' },
                        { label: 'Remove Category', value: 'remove_category', description: 'Remove an existing category' },
                        { label: 'Panel Info',      value: 'panel_info',      description: 'Edit the panel name and description' },
                        { label: 'Set Thumbnail',   value: 'thumbnail',       description: 'Set the panel thumbnail image URL' },
                    ])
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_setup_roles_button')
                    .setLabel('Configure Staff Roles')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('ticket_setup_publish')
                    .setLabel('Publish Panel')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(session.categories.length === 0)
            )
        );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildRolesMessage(session) {
    const rolesList = session.staffRoles.length > 0
        ? session.staffRoles.map(id => `<@&${id}>`).join(', ')
        : '*None configured*';

    const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent([
                '## Configure Staff Roles',
                'Select the roles that can **claim** and **respond** to tickets.',
                'Staff with these roles can see tickets but cannot write until they claim one.',
                '',
                `**Current roles:** ${rolesList}`,
            ].join('\n'))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('ticket_setup_roles_select')
                    .setPlaceholder('Select staff roles...')
                    .setMinValues(0)
                    .setMaxValues(10)
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_setup_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary)
            )
        );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildRemoveMessage(session) {
    const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## Remove Categories\nSelect the categories you want to remove:')
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_setup_remove')
                    .setPlaceholder('Select categories to remove...')
                    .setMinValues(1)
                    .setMaxValues(session.categories.length)
                    .addOptions(
                        session.categories.map((c, i) => ({
                            label: c.name,
                            value: String(i),
                            description: c.description || undefined,
                        }))
                    )
            )
        )
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_setup_back')
                    .setLabel('Back')
                    .setStyle(ButtonStyle.Secondary)
            )
        );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildPanelMessage(session, categories) {
    const buttons = categories.map(cat =>
        new ButtonBuilder()
            .setCustomId(`ticket_open:${cat.id}`)
            .setLabel(cat.name)
            .setStyle(ButtonStyle.Secondary)
    );

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }

    const container = new ContainerBuilder().setAccentColor(ACCENT);

    if (session.thumbnail) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${session.name}\n${session.description}`)
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(session.thumbnail)
                )
        );
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${session.name}\n${session.description}`)
        );
    }

    container.addSeparatorComponents(new SeparatorBuilder());
    for (const row of rows) container.addActionRowComponents(row);

    return container;
}

// ─── Interaction handlers ─────────────────────────────────────────────────────

async function handleSetupSelect(interaction) {
    const sessionKey = setupState.key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) {
        return interaction.update({
            components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('Session expired. Run `/ticket-setup` again.'))],
            flags: MessageFlags.IsComponentsV2,
        });
    }

    const [value] = interaction.values;

    if (value === 'add_category') {
        return interaction.showModal(
            new ModalBuilder()
                .setCustomId('ticket_modal_category')
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
        if (session.categories.length === 0) return interaction.update(buildSetupMessage(session));
        return interaction.update(buildRemoveMessage(session));
    }

    if (value === 'panel_info') {
        return interaction.showModal(
            new ModalBuilder()
                .setCustomId('ticket_modal_info')
                .setTitle('Panel Info')
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
                .setCustomId('ticket_modal_thumbnail')
                .setTitle('Set Thumbnail')
                .addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder().setCustomId('url').setLabel('Image URL').setStyle(TextInputStyle.Short).setPlaceholder('https://...').setValue(session.thumbnail || '').setMaxLength(500).setRequired(false)
                    )
                )
        );
    }
}

async function handleRemoveSelect(interaction) {
    const sessionKey = setupState.key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;
    const toRemove = new Set(interaction.values.map(Number));
    session.categories = session.categories.filter((_, i) => !toRemove.has(i));
    setupState.set(sessionKey, session);
    await interaction.update(buildSetupMessage(session));
}

async function handleRolesButton(interaction) {
    const sessionKey = setupState.key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;
    await interaction.update(buildRolesMessage(session));
}

async function handleRolesSelect(interaction) {
    const sessionKey = setupState.key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;
    session.staffRoles = interaction.values;
    setupState.set(sessionKey, session);
    await interaction.update(buildRolesMessage(session));
}

async function handleBack(interaction) {
    const sessionKey = setupState.key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;
    await interaction.update(buildSetupMessage(session));
}

async function handlePublish(interaction) {
    const sessionKey = setupState.key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return;

    await interaction.deferUpdate();

    const guild = interaction.guild;
    const adminRoleId = process.env.ADMIN_ROLE_ID;

    const panelResult = ticketQueries.createPanel(
        guild.id, session.targetChannelId, session.name,
        session.description, session.thumbnail, session.staffRoles
    );
    const panelId = panelResult.lastInsertRowid;

    const publishedCategories = [];
    for (const cat of session.categories) {
        const permOverwrites = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        ];
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

        const discordCat = await guild.channels.create({
            name: cat.name,
            type: ChannelType.GuildCategory,
            permissionOverwrites: permOverwrites,
        });

        const catResult = ticketQueries.addCategory(panelId, guild.id, cat.name, cat.description, cat.emoji, discordCat.id);
        publishedCategories.push({ ...cat, id: catResult.lastInsertRowid, discordCategoryId: discordCat.id });
    }

    const panelContainer = buildPanelMessage(session, publishedCategories);
    const targetChannel = await guild.channels.fetch(session.targetChannelId);
    const panelMessage = await targetChannel.send({ components: [panelContainer], flags: MessageFlags.IsComponentsV2 });

    ticketQueries.updatePanelMessageId(panelId, panelMessage.id);

    await sendLog(interaction.client, guild.id, [
        `## Panel Created`,
        `**Name:** ${session.name}`,
        `**Channel:** <#${session.targetChannelId}>`,
        `**Categories:** ${publishedCategories.map(c => c.name).join(', ')}`,
        `**Created by:** <@${interaction.user.id}>`,
    ]);

    setupState.delete(sessionKey);

    const successContainer = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Panel Published\nThe ticket panel has been sent to <#${session.targetChannelId}>.`
            )
        );

    await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
}

async function handleCategoryModal(interaction) {
    const sessionKey = setupState.key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return interaction.reply({ content: 'Session expired. Run `/ticket-setup` again.', flags: MessageFlags.Ephemeral });
    session.categories.push({ name: interaction.fields.getTextInputValue('name'), description: interaction.fields.getTextInputValue('description') || null, emoji: null });
    setupState.set(sessionKey, session);
    await interaction.update(buildSetupMessage(session));
}

async function handleInfoModal(interaction) {
    const sessionKey = setupState.key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return interaction.reply({ content: 'Session expired. Run `/ticket-setup` again.', flags: MessageFlags.Ephemeral });
    session.name = interaction.fields.getTextInputValue('name');
    session.description = interaction.fields.getTextInputValue('description');
    setupState.set(sessionKey, session);
    await interaction.update(buildSetupMessage(session));
}

async function handleThumbnailModal(interaction) {
    const sessionKey = setupState.key(interaction.guildId, interaction.user.id);
    const session = setupState.get(sessionKey);
    if (!session) return interaction.reply({ content: 'Session expired. Run `/ticket-setup` again.', flags: MessageFlags.Ephemeral });
    session.thumbnail = interaction.fields.getTextInputValue('url').trim() || null;
    setupState.set(sessionKey, session);
    await interaction.update(buildSetupMessage(session));
}

// ─── Router ───────────────────────────────────────────────────────────────────

module.exports = {
    ids: [
        'ticket_setup_select',
        'ticket_setup_remove',
        'ticket_setup_back',
        'ticket_setup_publish',
        'ticket_setup_roles_button',
        'ticket_setup_roles_select',
        'ticket_modal_category',
        'ticket_modal_info',
        'ticket_modal_thumbnail',
    ],

    buildSetupMessage,

    async execute(interaction) {
        switch (interaction.customId) {
            case 'ticket_setup_select':       return handleSetupSelect(interaction);
            case 'ticket_setup_remove':       return handleRemoveSelect(interaction);
            case 'ticket_setup_back':         return handleBack(interaction);
            case 'ticket_setup_publish':      return handlePublish(interaction);
            case 'ticket_setup_roles_button': return handleRolesButton(interaction);
            case 'ticket_setup_roles_select': return handleRolesSelect(interaction);
            case 'ticket_modal_category':     return handleCategoryModal(interaction);
            case 'ticket_modal_info':         return handleInfoModal(interaction);
            case 'ticket_modal_thumbnail':    return handleThumbnailModal(interaction);
        }
    },
};
