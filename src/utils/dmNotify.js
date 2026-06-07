async function notify(client, userId, content) {
    try {
        const user = await client.users.fetch(userId);
        await user.send(content);
    } catch {
        // User has DMs disabled or blocked the bot — fail silently
    }
}

module.exports = { notify };
