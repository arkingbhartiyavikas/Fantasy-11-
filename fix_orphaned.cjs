const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target = `          if (!isExisting && legacyMobile) {
            let legacyDocRef = doc(db, "users", legacyMobile);
            let legacyDoc = await getDoc(legacyDocRef);
            if (legacyDoc.exists()) {
              isExisting = true;
              userDoc = legacyDoc;
              existingDocId = legacyDoc.id;
            }
          }`;

const replacement = `          if (!isExisting && legacyMobile) {
            let legacyDocRef = doc(db, "users", legacyMobile);
            let legacyDoc = await getDoc(legacyDocRef);
            if (legacyDoc.exists()) {
              isExisting = true;
              userDoc = legacyDoc;
              existingDocId = legacyDoc.id;
            } else {
              // Check if orphaned wallet exists
              let legacyWalletRef = doc(db, "wallets", legacyMobile);
              let legacyWallet = await getDoc(legacyWalletRef);
              if (legacyWallet.exists()) {
                isExisting = true;
                await setDoc(legacyDocRef, {
                    name: "Fantasy Player",
                    mobile: legacyMobile,
                    email: fbUser.email || \`\${legacyMobile}@dreamapp.com\`,
                    numericId: legacyMobile,
                    createdAt: new Date().toISOString(),
                    isBot: false,
                    supaId: uid,
                });
                userDoc = await getDoc(legacyDocRef);
                existingDocId = legacyMobile;
              }
            }
          }`;

file = file.replace(target, replacement);
fs.writeFileSync('src/App.tsx', file);
console.log("FIXED ORPHANED");
