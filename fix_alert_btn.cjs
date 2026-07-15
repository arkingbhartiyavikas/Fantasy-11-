const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                                    if (selectedIds.length === 0) {
                                        alert("Please select at least one contest to delete.");
                                        return;
                                    }`;

const replacement = `                                    if (selectedIds.length === 0) {
                                        try { window.alert("Please select at least one contest to delete."); } catch(e) {}
                                        return;
                                    }`;

if(file.includes(target)) {
  file = file.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', file);
  console.log("SUCCESS ALERT");
} else {
  console.log("NOT FOUND ALERT");
}
