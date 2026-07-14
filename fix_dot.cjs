const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

file = file.replace(/<div className="w-2 h-2 rounded-full bg-app-accent"><\/div>/g, '<div className="w-1.5 h-1.5 rounded-full bg-app-accent opacity-50"></div>');

fs.writeFileSync('src/App.tsx', file);
