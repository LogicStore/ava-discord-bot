const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    client.components = [];

    const componentsPath = path.join(__dirname, '..', 'components');
    const files = fs.readdirSync(componentsPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
        const component = require(path.join(componentsPath, file));
        client.components.push(component);
        console.log(`[Components] ${file} loaded`);
    }
};
