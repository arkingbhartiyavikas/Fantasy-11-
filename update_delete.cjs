const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<p className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest mb-3">
                              Available Contests
                            </p>`;

const replacement = `<div className="flex items-center justify-between mb-3">
                              <p className="text-[10px] font-black text-[#e5c158]/70 uppercase tracking-widest">
                                Available Contests
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    const allSelected = appContests.length > 0 && appContests.every(c => selectedContestsForMatch[c.id]);
                                    const newSelected = {};
                                    if (!allSelected) {
                                      appContests.forEach(c => newSelected[c.id] = true);
                                    }
                                    setSelectedContestsForMatch(newSelected);
                                  }}
                                  className="text-[10px] px-2 py-1 bg-[#e5c158]/10 text-[#e5c158] hover:bg-[#e5c158]/20 border border-[#e5c158]/30 rounded transition-all font-bold uppercase tracking-wider"
                                >
                                  {appContests.length > 0 && appContests.every(c => selectedContestsForMatch[c.id]) ? "Deselect All" : "Select All"}
                                </button>
                                <button
                                  onClick={() => {
                                    const selectedIds = Object.keys(selectedContestsForMatch).filter(id => selectedContestsForMatch[id]);
                                    if (selectedIds.length === 0) {
                                        alert("Please select at least one contest to delete.");
                                        return;
                                    }
                                    if (confirm("Are you sure you want to delete " + selectedIds.length + " contests?")) {
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
                                    }
                                  }}
                                  className="text-[10px] px-2 py-1 bg-red-900/30 text-red-400 border border-red-500/30 rounded hover:bg-red-900/50 transition-all font-bold uppercase tracking-wider"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>`;

if(file.includes(target)) {
  file = file.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', file);
  console.log("SUCCESS");
} else {
  console.log("NOT FOUND");
}
