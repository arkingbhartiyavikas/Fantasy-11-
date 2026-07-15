const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

if (!file.includes("arrayUnion,")) {
  file = file.replace(/writeBatch,/g, 'writeBatch, arrayUnion,');
  fs.writeFileSync('src/App.tsx', file);
  console.log("ADDED ARRAY UNION IMPORT");
} else {
  console.log("ALREADY PRESENT");
}
