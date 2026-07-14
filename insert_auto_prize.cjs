const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const anchor = `{adminTab === "MATCHES" && (`;
const insertPos = file.lastIndexOf(anchor);

const newUI = `          {adminTab === "CONTESTS" && adminContestDashboard === "AUTO_PRIZE" && (
            <div className="absolute inset-0 bg-[#090b10] z-50 flex flex-col overflow-hidden animate-in slide-in-from-right-4">
              <div className="flex-none p-4 sticky top-0 bg-[#090b10] flex items-center justify-between border-b border-slate-800 shadow-sm z-50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAdminContestDashboard(null)}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-800 transition-colors"
                  >
                    <ArrowLeft size={18} className="text-slate-400" />
                  </button>
                  <h2 className="text-base font-black text-slate-100 flex items-center gap-2">
                    <Trophy size={16} className="text-[#e5c158]" /> Auto Prize Generation
                  </h2>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar p-5 pb-10">
                <p className="text-xs text-slate-400 mb-5 pl-1">
                  Generate H2H (2 spots), 3, 4, and 5 spot contests up to a maximum prize pool. Each contest will have 1 winner.
                </p>
                <div className="bg-[#13151c] p-5 rounded-xl border border-slate-800 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Max Prize Pool</label>
                    <input id="autoPrizeMax" type="number" defaultValue="100" className="w-full bg-[#090b10] border border-slate-700 text-white p-3 rounded-lg font-bold outline-none focus:border-[#e5c158]" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Platform Margin (%)</label>
                    <input id="autoPrizeMargin" type="number" defaultValue="15" className="w-full bg-[#090b10] border border-slate-700 text-white p-3 rounded-lg font-bold outline-none focus:border-[#e5c158]" />
                  </div>
                  
                  <button
                    onClick={async () => {
                       const maxPoolInput = document.getElementById("autoPrizeMax");
                       const marginInput = document.getElementById("autoPrizeMargin");
                       const maxPool = parseInt((maxPoolInput as HTMLInputElement).value) || 100;
                       const margin = parseFloat((marginInput as HTMLInputElement).value) || 15;
                       
                       if (!window.confirm("This will generate " + (maxPool * 4) + " contests. Are you sure?")) return;
                       
                       try {
                         const batch1 = writeBatch(db);
                         const batch2 = writeBatch(db);
                         const batch3 = writeBatch(db);
                         const batch4 = writeBatch(db);
                         const batch5 = writeBatch(db);
                         const batches = [batch1, batch2, batch3, batch4, batch5];
                         let bIdx = 0;
                         let opCount = 0;

                         for (let spots = 2; spots <= 5; spots++) {
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
                         }
                         
                         alert("Successfully generated Auto Prize contests!");
                       } catch(e: any) {
                         alert("Error: " + e.message);
                       }
                    }}
                    className="w-full bg-[#e5c158] text-black font-black py-4 rounded-xl shadow-[0_0_20px_rgba(229,193,88,0.2)] hover:shadow-[0_0_30px_rgba(229,193,88,0.4)] transition-all uppercase tracking-widest"
                  >
                    Generate Contests
                  </button>
                </div>
              </div>
            </div>
          )}
`;

// Insert the new UI just before the MATCHES tab condition
if (insertPos !== -1) {
    file = file.substring(0, insertPos) + newUI + file.substring(insertPos);
    fs.writeFileSync('src/App.tsx', file);
    console.log("INSERTED AUTO_PRIZE UI");
} else {
    console.log("Could not find insertion point.");
}
