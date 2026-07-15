const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `            if (/^\\d{10}$/.test(u.id)) {
              const realUser = Object.values(metaDocs).find(
                (m: any) => m.numericId === u.id,
              );
              if (realUser) return false; // Skip this numeric entry, it will be merged into the UID one
            }`;
const replacement1 = `            if (/^\\d{10}$/.test(u.id)) {
              const realUser = Object.values(metaDocs).find(
                (m: any) => m.numericId === u.id && m.id !== u.id,
              );
              if (realUser) return false; // Skip this numeric entry, it will be merged into the UID one
            }`;

const target2 = `                        if (/^\\d{10}$/.test(u.id)) {
                          const realUser = Object.values(metaDocs).find(
                            (m: any) => m.numericId === u.id,
                          );
                          if (realUser) return false;
                        }`;
const replacement2 = `                        if (/^\\d{10}$/.test(u.id)) {
                          const realUser = Object.values(metaDocs).find(
                            (m: any) => m.numericId === u.id && m.id !== u.id,
                          );
                          if (realUser) return false;
                        }`;

file = file.replace(target1, replacement1);
file = file.replace(target2, replacement2);

fs.writeFileSync('src/App.tsx', file);
console.log("FIXED FILTER");
