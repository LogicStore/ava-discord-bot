require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

commandHandler(client);
eventHandler(client);

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[Erreur] Commande /${interaction.commandName} :`, error);
        const msg = { content: 'Une erreur est survenue lors de l\'exécution de cette commande.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(msg);
        } else {
            await interaction.reply(msg);
        }
    }
});

client.once('clientReady', () => {
    console.log(`\n✅ Ava est en ligne ! Connectée en tant que ${client.user.tag}`);
    console.log(`📦 ${client.commands.size} commande(s) chargée(s)\n`);
});

client.login(process.env.DISCORD_TOKEN);
