const {
    SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder,
    SeparatorBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags,
} = require('discord.js');
const ticketQueries = require('../../database/ticketQueries');

const ACCENT = 0x0056CA;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-edit')
        .setDescription('Edit an existing ticket panel'),

    async execute(interaction) {
        const adminRoleId = process.env.ADMIN_ROLE_ID;
        if (!adminRoleId || !interaction.member.roles.cache.has(adminRoleId)) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const panels = ticketQueries.getAllPanels(interaction.guildId);
        if (panels.length === 0) {
            return interaction.reply({
                content: 'No ticket panels found. Use `/ticket-setup` to create one first.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const container = new ContainerBuilder()
            .setAccentColor(ACCENT)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('## Edit Ticket Panel\nSelect the panel you want to edit:')
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ticket_edit_panel_select')
                        .setPlaceholder('Select a panel...')
                        .addOptions(
                            panels.map(p => ({
                                label: p.name.slice(0, 100),
                                value: String(p.id),
                                description: `Panel #${p.id} — ${(p.description || '').slice(0, 80)}`.slice(0, 100),
                            }))
                        )
                )
            );

        return interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
    },
};
