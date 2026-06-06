const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
    ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
    MessageFlags,
} = require('discord.js');

const ticketQueries = require('../database/ticketQueries');

const ACCENT = 0x0056CA;

function buildPanelSelectMessage(panels) {
    const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                '## Delete Ticket Panel\nSelect a panel to delete. All associated categories and open ticket channels will be permanently removed.'
            )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('ticket_delete_select')
                    .setPlaceholder('Select a panel...')
                    .addOptions(
                        panels.map(p => ({
                            label: p.name.slice(0, 100),
                            value: String(p.id),
                            description: `ID: ${p.id} — Channel: ${p.channel_id}`,
                        }))
                    )
            )
        );

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function handleDeleteSelect(interaction) {
    const panelId = parseInt(interaction.values[0]);
    const panel = ticketQueries.getPanelById(panelId);
    if (!panel) return interaction.update({ content: 'Panel not found.', components: [] });

    const categories = ticketQueries.getCategoriesByPanel(panelId);
    let openTicketCount = 0;
    for (const cat of categories) {
        openTicketCount += ticketQueries.getOpenTicketsByCategory(cat.id).length;
    }

    const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent([
                '## Confirm Deletion',
                `**Panel:** ${panel.name}`,
                `**Channel:** <#${panel.channel_id}>`,
                `**Categories:** ${categories.length}`,
                `**Open Tickets:** ${openTicketCount}`,
            ].join('\n'))
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                'This action is irreversible. All associated Discord categories, channels and database records will be permanently deleted.'
            )
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_delete_confirm:${panelId}`)
                    .setLabel('Confirm Delete')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('ticket_delete_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            )
        );

    await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function handleDeleteConfirm(interaction) {
    const panelId = parseInt(interaction.customId.split(':')[1]);
    const panel = ticketQueries.getPanelById(panelId);
    if (!panel) return interaction.update({ content: 'Panel not found.', components: [] });

    await interaction.deferUpdate();

    const guild = interaction.guild;
    const categories = ticketQueries.getCategoriesByPanel(panelId);

    for (const cat of categories) {
        const openTickets = ticketQueries.getOpenTicketsByCategory(cat.id);
        for (const ticket of openTickets) {
            const ch = await guild.channels.fetch(ticket.channel_id).catch(() => null);
            if (ch) await ch.delete().catch(() => {});
        }
        if (cat.discord_category_id) {
            const discordCat = await guild.channels.fetch(cat.discord_category_id).catch(() => null);
            if (discordCat) await discordCat.delete().catch(() => {});
        }
    }

    if (panel.message_id) {
        const panelChannel = await guild.channels.fetch(panel.channel_id).catch(() => null);
        if (panelChannel) {
            const msg = await panelChannel.messages.fetch(panel.message_id).catch(() => null);
            if (msg) await msg.delete().catch(() => {});
        }
    }

    ticketQueries.deleteTicketsByPanel(panelId);
    ticketQueries.deletePanel(panelId);

    const successContainer = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## Panel Deleted\n**${panel.name}** and all associated data have been permanently removed.`
            )
        );

    await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
}

async function handleDeleteCancel(interaction) {
    const panels = ticketQueries.getAllPanels(interaction.guildId);
    if (panels.length === 0) {
        return interaction.update({
            components: [new ContainerBuilder().setAccentColor(ACCENT).addTextDisplayComponents(new TextDisplayBuilder().setContent('No panels found.'))],
            flags: MessageFlags.IsComponentsV2,
        });
    }
    await interaction.update(buildPanelSelectMessage(panels));
}

module.exports = {
    ids: ['ticket_delete_select', 'ticket_delete_confirm:*', 'ticket_delete_cancel'],

    buildPanelSelectMessage,

    async execute(interaction) {
        if (interaction.customId === 'ticket_delete_select')               return handleDeleteSelect(interaction);
        if (interaction.customId.startsWith('ticket_delete_confirm:'))     return handleDeleteConfirm(interaction);
        if (interaction.customId === 'ticket_delete_cancel')               return handleDeleteCancel(interaction);
    },
};
