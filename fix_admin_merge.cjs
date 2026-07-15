const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target1 = `                      .map((u) => {
                        if (
                          u.numericId &&
                          !u.deposit &&
                          !u.winning &&
                          !u.bonus
                        ) {
                          const legacyWallet = walletDocs[u.numericId];
                          if (legacyWallet) return { ...u, ...legacyWallet };
                        }
                        return u;
                      });`;

const replacement1 = `                      .map((u) => {
                        if (u.numericId) {
                          const legacyWallet = walletDocs[u.numericId];
                          if (legacyWallet) {
                             // Prefer legacy wallet if it has more funds, or combine them
                             return { 
                                 ...u, 
                                 deposit: Math.max(u.deposit || 0, legacyWallet.deposit || 0),
                                 winning: Math.max(u.winning || 0, legacyWallet.winning || 0),
                                 bonus: Math.max(u.bonus || 0, legacyWallet.bonus || 0)
                             };
                          }
                        }
                        return u;
                      });`;

file = file.replace(target1, replacement1);
file = file.replace(target1, replacement1); // Replace both occurrences (admin_fetch and adminRefreshBtn)

fs.writeFileSync('src/App.tsx', file);
console.log("FIXED ADMIN MERGE");
