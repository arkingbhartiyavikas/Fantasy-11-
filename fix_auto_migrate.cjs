const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `          const allUids = new Set([
            ...Object.keys(metaDocs),
            ...Object.keys(walletDocs),
          ]);`;

const replacement1 = `          // Auto-migrate legacy wallets to users collection for permanent storage
          for (const k of Object.keys(walletDocs)) {
            if (/^\\d{10}$/.test(k) && !metaDocs[k]) {
              try {
                const newDoc = {
                  name: "Legacy Player",
                  mobile: k,
                  email: \`\${k}@dreamapp.com\`,
                  numericId: k,
                  createdAt: new Date().toISOString(),
                  isBot: false
                };
                setDoc(doc(db, "users", k), newDoc, { merge: true }).catch(()=>{});
                metaDocs[k] = newDoc;
              } catch(e) {}
            }
          }
          
          const allUids = new Set([
            ...Object.keys(metaDocs),
            ...Object.keys(walletDocs),
          ]);`;

file = file.replace(target1, replacement1);
file = file.replace(target1, replacement1); // Replace for both fetchAdminData and adminRefreshBtn

fs.writeFileSync('src/App.tsx', file);
console.log("FIXED AUTO MIGRATE");
