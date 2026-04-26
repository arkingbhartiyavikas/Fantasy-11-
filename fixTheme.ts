import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  { search: /bg-\[\#172134\]/g, replace: "bg-app-card" },
  { search: /bg-\[\#242F41\]/g, replace: "bg-app-card-hover" },
  { search: /bg-\[\#121A2F\]/g, replace: "bg-app-bg" },
  { search: /bg-\[\#FF3B5C\]/g, replace: "bg-app-accent" },
  { search: /bg-\[\#E03550\]/g, replace: "bg-app-accent" }
];

for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
}

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx theme updated.');
