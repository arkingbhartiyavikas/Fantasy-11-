const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

file = file.replace(
  'setAdminUserList(list);',
  'console.log("Setting adminUserList:", list.length, list.slice(0, 2)); setAdminUserList(list);'
);

fs.writeFileSync('src/App.tsx', file);
console.log("ADDED CONSOLE LOG");
