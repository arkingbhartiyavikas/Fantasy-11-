const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target = `            const newUser = {
              email: fbUser.email || data.email || "",
              name: data.name || fbUser.displayName || "Fantasy Player",
              id: existingDocId,
              numericId: numericId,
              photoURL: data.photoURL,
            };
            localStorage.setItem("dreamApp_user", JSON.stringify(newUser));
            setUser(newUser);
          }`;

const replacement = `            // Migration logic for orphaned wallet balances
            if (existingDocId !== numericId && numericId) {
                try {
                    let oldWalletRef = doc(db, "wallets", numericId);
                    let oldWalletSnap = await getDoc(oldWalletRef);
                    if (oldWalletSnap.exists()) {
                        let currentWalletRef = doc(db, "wallets", existingDocId);
                        let currentWalletSnap = await getDoc(currentWalletRef);
                        
                        let oldD = oldWalletSnap.data();
                        let currD = currentWalletSnap.exists() ? currentWalletSnap.data() : { deposit: 0, winning: 0, bonus: 0 };
                        
                        // Merge them (take the max or add them up, let's take max to avoid double counting if already merged)
                        let merged = {
                            deposit: Math.max(currD.deposit || 0, oldD.deposit || 0),
                            winning: Math.max(currD.winning || 0, oldD.winning || 0),
                            bonus: Math.max(currD.bonus || 0, oldD.bonus || 0),
                        };
                        
                        await setDoc(currentWalletRef, merged, { merge: true });
                        // Delete the old one so we don't migrate again
                        await deleteDoc(oldWalletRef);
                    }
                } catch(e) {
                    console.error("Wallet migration error", e);
                }
            }

            const newUser = {
              email: fbUser.email || data.email || "",
              name: data.name || fbUser.displayName || "Fantasy Player",
              id: existingDocId,
              numericId: numericId,
              photoURL: data.photoURL,
            };
            localStorage.setItem("dreamApp_user", JSON.stringify(newUser));
            setUser(newUser);
          }`;

file = file.replace(target, replacement);
fs.writeFileSync('src/App.tsx', file);
console.log("FIXED MIGRATION");
