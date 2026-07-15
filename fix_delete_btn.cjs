const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target = `                                    if (confirm("Are you sure you want to delete " + selectedIds.length + " contests?")) {
                                        const newContests = appContests.filter(c => !selectedIds.includes(c.id));
                                        setAppContests(newContests);
                                        syncCategoryToCloud("contests", newContests, 20);
                                        
                                        const newMatches = appMatches.map(m => {
                                          if (!m.contestIds) return m;
                                          return {
                                             ...m,
                                             contestIds: m.contestIds.filter(id => !selectedIds.includes(id))
                                          };
                                        });
                                        setAppMatches(newMatches);
                                        syncCategoryToCloud("matches", newMatches, 20);
                                        setSelectedContestsForMatch({});
                                    }`;

const replacement = `                                    let shouldDelete = true;
                                    try {
                                      shouldDelete = window.confirm("Are you sure you want to delete " + selectedIds.length + " contests?");
                                    } catch(e) {
                                      shouldDelete = true;
                                    }
                                    
                                    if (shouldDelete) {
                                        const newContests = appContests.filter(c => !selectedIds.includes(c.id));
                                        setAppContests(newContests);
                                        syncCategoryToCloud("contests", newContests, 20);
                                        
                                        const newMatches = appMatches.map(m => {
                                          if (!m.contestIds) return m;
                                          return {
                                             ...m,
                                             contestIds: m.contestIds.filter(id => !selectedIds.includes(id))
                                          };
                                        });
                                        setAppMatches(newMatches);
                                        syncCategoryToCloud("matches", newMatches, 20);
                                        setSelectedContestsForMatch({});
                                    }`;

if(file.includes(target)) {
  file = file.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', file);
  console.log("SUCCESS");
} else {
  console.log("NOT FOUND");
}
