const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

let startIndex1 = file.indexOf('{adminTab === "CONTESTS" && adminContestDashboard === "AUTO_PRIZE" && (');
let endIndex1 = file.indexOf('{adminTab === "CONTESTS" && adminContestDashboard === "ADD_PRIZE_POOL" && (');
if (startIndex1 !== -1 && endIndex1 !== -1) {
  file = file.slice(0, startIndex1) + file.slice(endIndex1);
}

let startIndex2 = file.indexOf('{adminTab === "CONTESTS" && adminContestDashboard === "ADD_PRIZE_POOL" && (');
let endIndex2 = file.indexOf('{adminTab === "MATCHES" && (');
if (startIndex2 !== -1 && endIndex2 !== -1) {
  file = file.slice(0, startIndex2) + file.slice(endIndex2);
}

fs.writeFileSync('src/App.tsx', file);
console.log("REMOVED VIEWS");
