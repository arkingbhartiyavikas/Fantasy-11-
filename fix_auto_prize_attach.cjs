const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const oldCode = `                         for (let spots = 2; spots <= 5; spots++) {
                           for (let pool = 1; pool <= maxPool; pool++) {
                             // Total Collected = pool / (1 - margin / 100)
                             // Entry Fee = Total Collected / spots
                             const entryFee = Math.ceil((pool / (1 - margin / 100)) / spots);
                             const contestId = "AUTO_" + spots + "SPOT_" + pool + "POOL_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                             const contest = {
                               id: contestId,
                               name: spots === 2 ? "Head to Head" : spots + " Spots (1 Winner)",
                               prizePool: pool,
                               entryFee: entryFee,
                               spots: spots,
                               firstPrizePercent: 100,
                               winnersPercent: Math.round(100 / spots),
                               platformMargin: margin,
                               autoPayouts: true,
                               customPayouts: [{ rankFrom: 1, rankTo: 1, amount: pool }],
                               isPublic: true,
                               createdAt: new Date().toISOString()
                             };
                             
                             batches[bIdx].set(doc(db, "app_contests", contestId), contest);
                             opCount++;
                             if (opCount >= 490) {
                               bIdx++;
                               opCount = 0;
                               if(bIdx >= batches.length) break; // Safeguard
                             }
                           }
                         }
                         
                         for(let i=0; i<=bIdx; i++) {
                           if(batches[i]) await batches[i].commit();
                         }`;

const newCode = `                         const newContestIds = [];
                         for (let spots = 2; spots <= 5; spots++) {
                           for (let pool = 1; pool <= maxPool; pool++) {
                             // Total Collected = pool / (1 - margin / 100)
                             // Entry Fee = Total Collected / spots
                             const entryFee = Math.ceil((pool / (1 - margin / 100)) / spots);
                             const contestId = "AUTO_" + spots + "SPOT_" + pool + "POOL_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
                             newContestIds.push(contestId);
                             const contest = {
                               id: contestId,
                               name: spots === 2 ? "Head to Head" : spots + " Spots (1 Winner)",
                               prizePool: pool,
                               entryFee: entryFee,
                               spots: spots,
                               firstPrizePercent: 100,
                               winnersPercent: Math.round(100 / spots),
                               platformMargin: margin,
                               autoPayouts: true,
                               customPayouts: [{ rankFrom: 1, rankTo: 1, amount: pool }],
                               isPublic: true,
                               type: spots === 2 ? "H2H" : "Mega",
                               prizeText: "₹" + pool,
                               createdAt: new Date().toISOString()
                             };
                             
                             batches[bIdx].set(doc(db, "app_contests", contestId), contest);
                             opCount++;
                             if (opCount >= 490) {
                               bIdx++;
                               opCount = 0;
                               if(bIdx >= batches.length) break; // Safeguard
                             }
                           }
                         }
                         
                         // Attach to upcoming matches
                         const upcomingMatches = appMatches.filter(m => m.status === "Upcoming" || m.status === "Live");
                         for (const match of upcomingMatches) {
                            if (opCount + 1 > 490) {
                               bIdx++;
                               opCount = 0;
                            }
                            if (bIdx < batches.length) {
                               batches[bIdx].update(doc(db, "matches", match.id), {
                                  contestIds: arrayUnion(...newContestIds)
                               });
                               opCount++;
                            }
                         }
                         
                         for(let i=0; i<=bIdx; i++) {
                           if(batches[i] && opCount > 0) await batches[i].commit();
                           else if (batches[i] && i === 0) await batches[i].commit(); 
                         }`;

file = file.replace(oldCode, newCode);
fs.writeFileSync('src/App.tsx', file);
