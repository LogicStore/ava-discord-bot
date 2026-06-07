require('dotenv').config();
const { Client, GatewayIntentBits, MessageFlags, ActivityType } = require('discord.js');

const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');
const componentHandler = require('./handlers/componentHandler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
    ],
});

commandHandler(client);
eventHandler(client);
componentHandler(client);

function findComponentHandler(customId) {
    return client.components.find(h =>
        h.ids.some(id =>
            id.endsWith(':*')
                ? customId.startsWith(id.slice(0, -1))
                : customId === id
        )
    );
}

async function handleError(interaction, error) {
    console.error(`[Error]`, error);
    const msg = { content: 'An error occurred while processing this interaction.', flags: MessageFlags.Ephemeral };
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg);
        } else {
            await interaction.reply(msg);
        }
    } catch {}
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try { await command.execute(interaction); }
        catch (err) { await handleError(interaction, err); }
        return;
    }

    if (interaction.isAnySelectMenu() || interaction.isButton() || interaction.isModalSubmit()) {
        const handler = findComponentHandler(interaction.customId);
        if (!handler) return;
        try { await handler.execute(interaction); }
        catch (err) { await handleError(interaction, err); }
    }
});

client.once('clientReady', async () => {
    console.log(`\n✅ Ava is online! Logged in as ${client.user.tag}`);
    console.log(`📦 ${client.commands.size} command(s) loaded`);
    console.log(`🔧 ${client.components.length} component handler(s) loaded\n`);

    await client.application.edit({ description: 'Slave for Logic Store' }).catch(() => {});

    client.user.setPresence({
        status: 'online',
        activities: [{
            name: 'Logic Store',
            type: ActivityType.Streaming,
            url: 'https://www.twitch.tv/logicstore',
        }],
    });
});

client.login(process.env.DISCORD_TOKEN);
