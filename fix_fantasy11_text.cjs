const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

// Replace in normal views
file = file.replace(/<h1 className="text-xl font-bold text-app-text">Fantasy11<\/h1>/g, '<h1 className="text-[10px] font-bold text-app-text-muted opacity-50 uppercase tracking-widest">FANTASY11</h1>');

// Replace in admin profile modal user
file = file.replace(/<div className="flex items-center gap-2">\s*<div className="w-2 h-2 rounded-full bg-app-accent"><\/div>\s*<h1 className="text-xl font-bold">Fantasy11<\/h1>\s*<\/div>/g, '<div></div>');

fs.writeFileSync('src/App.tsx', file);
console.log("REPLACED FANTASY11 TEXT");
