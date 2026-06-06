const sessions = new Map();

module.exports = {
    key: (guildId, userId) => `${guildId}:${userId}`,
    get: (key) => sessions.get(key),
    set: (key, value) => sessions.set(key, value),
    delete: (key) => sessions.delete(key),
};
