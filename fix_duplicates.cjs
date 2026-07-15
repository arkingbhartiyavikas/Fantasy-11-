const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');
const lines = file.split('\n');

// Keep lines 0 to 13386 (0-indexed, so up to line 13387)
const part1 = lines.slice(0, 13387);
// Keep lines 15000 to end (0-indexed, so from line 15001)
const part2 = lines.slice(15000);

const newFile = part1.join('\n') + '\n' + part2.join('\n');
fs.writeFileSync('src/App.tsx', newFile);
console.log("FIXED DUPLICATES");
