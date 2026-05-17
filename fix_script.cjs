const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// fix match properties
content = content.replace(/\b([a-zA-Z0-9_]+)\.team1\.shortFrame/g, '$1?.team1?.shortFrame');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team2\.shortFrame/g, '$1?.team2?.shortFrame');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team1\.color/g, '$1?.team1?.color');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team2\.color/g, '$1?.team2?.color');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team1\.name/g, '$1?.team1?.name');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team2\.name/g, '$1?.team2?.name');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team1\.logo/g, '$1?.team1?.flagUrl');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team2\.logo/g, '$1?.team2?.flagUrl');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team1\.flagUrl/g, '$1?.team1?.flagUrl');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team2\.flagUrl/g, '$1?.team2?.flagUrl');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team1\.flagFit/g, '$1?.team1?.flagFit');
content = content.replace(/\b([a-zA-Z0-9_]+)\.team2\.flagFit/g, '$1?.team2?.flagFit');

// Active match could be null causing errors in ContestTeams filter
content = content.replace(/activeMatch\.id/g, 'activeMatch?.id');
content = content.replace(/activeMatch\.status/g, 'activeMatch?.status');

// fix st.match
content = content.replace(/st\.match\.time/g, 'st.match?.time');
content = content.replace(/st\.match\.series/g, 'st.match?.series');
content = content.replace(/st\.match\.id/g, 'st.match?.id');

fs.writeFileSync('src/App.tsx', content);
