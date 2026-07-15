const fs = require('fs');
let tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
tsconfig.exclude = ["dist", "node_modules", "dist-server"];
fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2));
