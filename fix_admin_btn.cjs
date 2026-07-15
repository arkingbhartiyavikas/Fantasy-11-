const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const oldBtnCode = `\\n              {!adminContestDashboard && (
                <button
                  onClick={() => setAdminContestDashboard("AUTO_PRIZE")}
                  className={\`flex items-center justify-between w-full mt-4 bg-[#13151c] border border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30 p-4 shadow-lg transition-all relative group overflow-hidden\`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10">
                    <Trophy size={16} className="text-[#e5c158] mr-2" /> Auto
                    Prize Contests
                  </h3>
                </button>
              )}`;

const newBtnCode = `              {!adminContestDashboard && (
                <button
                  onClick={() => setAdminContestDashboard("ADD_PRIZE_POOL")}
                  className={\`flex items-center justify-between w-full mt-4 bg-[#13151c] border border-slate-800 rounded-xl mb-3 hover:border-[#e5c158]/30 p-4 shadow-lg transition-all relative group overflow-hidden\`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <h3 className="font-bold text-slate-200 tracking-wide flex items-center justify-between z-10">
                    <Trophy size={16} className="text-[#e5c158] mr-2" /> Add Prize Pool
                  </h3>
                </button>
              )}`;

file = file.replace(oldBtnCode, newBtnCode);
fs.writeFileSync('src/App.tsx', file);
console.log("FIXED");
