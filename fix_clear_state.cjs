const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

file = file.replace(
  'if (teamsListData && teamsListData.length > 0) {',
  'if (teamsListData) {'
);
file = file.replace(
  'if (matchesData && matchesData.length > 0) setAppMatches(matchesData);',
  'if (matchesData) setAppMatches(matchesData);'
);
file = file.replace(
  'if (contestsData && contestsData.length > 0)\n            setAppContests(contestsData);',
  'if (contestsData)\n            setAppContests(contestsData);'
);
file = file.replace(
  'if (contestsData && contestsData.length > 0) setAppContests(contestsData);',
  'if (contestsData) setAppContests(contestsData);'
);

fs.writeFileSync('src/App.tsx', file);
console.log("FIXED CLEAR STATE");
