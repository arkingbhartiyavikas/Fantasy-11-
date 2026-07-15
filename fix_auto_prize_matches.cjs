const fs = require('fs');
let lines = fs.readFileSync('src/App.tsx', 'utf8').split('\n');

const newCode = `                         for(let i=0; i<=bIdx; i++) {
                           if(batches[i] && opCount > 0) await batches[i].commit();
                           else if (batches[i] && i === 0) await batches[i].commit(); 
                         }

                         // Attach to upcoming matches client-side and sync
                         const updatedMatches = appMatches.map(m => {
                           if (m.status === "Upcoming" || m.status === "Live") {
                             return {
                               ...m,
                               contestIds: Array.from(new Set([...(m.contestIds || []), ...newContestIds]))
                             };
                           }
                           return m;
                         });
                         
                         setAppMatches(updatedMatches);
                         await syncCategoryToCloud("matches", updatedMatches, 20);`;

// We replace from line 13440 (0-indexed) to line 13458
lines.splice(13440, 19, newCode);
fs.writeFileSync('src/App.tsx', lines.join('\n'));
console.log("FIXED");
