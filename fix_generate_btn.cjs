const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const oldBtnCode = `                  <button
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
                  </button>`;

const newBtnCode = `                  <button
                    id="generateContestsBtn"
                    onClick={async () => {
                       const btn = document.getElementById("generateContestsBtn");
                       if (btn) btn.innerText = "Generating...";
                       
                       const maxPoolInput = document.getElementById("autoPrizeMax");
                       const marginInput = document.getElementById("autoPrizeMargin");
                       const maxPool = parseInt((maxPoolInput as HTMLInputElement).value) || 100;
                       const margin = parseFloat((marginInput as HTMLInputElement).value) || 15;
                       
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
                         
                         if (btn) {
                             btn.innerText = "Success! Generated " + (maxPool * 4) + " Contests";
                             btn.style.backgroundColor = "#4ADE80";
                             setTimeout(() => {
                                 btn.innerText = "Generate Contests";
                                 btn.style.backgroundColor = "#e5c158";
                             }, 3000);
                         }
                       } catch(e: any) {
                         if (btn) btn.innerText = "Error: " + e.message;
                         console.error(e);
                       }
                    }}
                    className="w-full bg-[#e5c158] text-black font-black py-4 rounded-xl shadow-[0_0_20px_rgba(229,193,88,0.2)] hover:shadow-[0_0_30px_rgba(229,193,88,0.4)] transition-all uppercase tracking-widest"
                  >
                    Generate Contests
                  </button>`;

file = file.replace(oldBtnCode, newBtnCode);
fs.writeFileSync('src/App.tsx', file);
console.log("FIXED GENERATE BTN");
