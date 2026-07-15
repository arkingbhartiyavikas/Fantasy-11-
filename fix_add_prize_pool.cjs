const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `            </div>
          )}
{adminTab === "MATCHES" && (`;

const insertStr = `            </div>
          )}
          {adminTab === "CONTESTS" && adminContestDashboard === "ADD_PRIZE_POOL" && (
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
                    <Trophy size={16} className="text-[#e5c158]" /> Generated Contests
                  </h2>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto no-scrollbar p-5 pb-10">
                <p className="text-xs text-slate-400 mb-5 pl-1">
                  All automatically generated contests are listed below.
                </p>
                <div className="space-y-3">
                  {appContests.filter(c => c.id && c.id.startsWith("AUTO_")).map(c => (
                    <div key={c.id} className="bg-[#13151c] p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-200">{c.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 rounded">{c.type || "Mega"}</span>
                          <span className="text-[10px] text-green-400 font-bold">Fee: ₹{c.entryFee}</span>
                          <span className="text-[10px] text-[#e5c158]">Pool: ₹{c.prizePool}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-400">{c.spots} Spots</div>
                      </div>
                    </div>
                  ))}
                  {appContests.filter(c => c.id && c.id.startsWith("AUTO_")).length === 0 && (
                    <div className="text-center text-slate-500 py-10 text-sm">
                      No auto-generated contests found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
{adminTab === "MATCHES" && (`;

if (file.includes(targetStr)) {
  file = file.replace(targetStr, insertStr);
  fs.writeFileSync('src/App.tsx', file);
  console.log("INSERTED ADD_PRIZE_POOL");
} else {
  console.log("TARGET STRING NOT FOUND");
}
