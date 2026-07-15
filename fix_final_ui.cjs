const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Rename the button in the form
file = file.replace(
  `Generate Contests\n                  </button>`,
  `Add Price Pool\n                  </button>`
);

// 2. Change success action to navigate to the list
const oldSuccessCode = `                             btn.innerText = "Success! Generated " + (maxPool * 4) + " Contests";
                             btn.style.backgroundColor = "#4ADE80";
                             setTimeout(() => {
                                 btn.innerText = "Generate Contests";
                                 btn.style.backgroundColor = "#e5c158";
                             }, 3000);`;

const newSuccessCode = `                             btn.innerText = "Success! Generated " + (maxPool * 4) + " Contests";
                             btn.style.backgroundColor = "#4ADE80";
                             setTimeout(() => {
                                 btn.innerText = "Add Price Pool";
                                 btn.style.backgroundColor = "#e5c158";
                                 setAdminContestDashboard("ADD_PRIZE_POOL");
                             }, 1500);`;

file = file.replace(oldSuccessCode, newSuccessCode);

// 3. Rename the menu item to match what the user might expect
file = file.replace(
  `<Trophy size={16} className="text-[#e5c158] mr-2" /> Auto Prize Contests`,
  `<Trophy size={16} className="text-[#e5c158] mr-2" /> Auto Generate Contests`
);

file = file.replace(
  `<Trophy size={16} className="text-[#e5c158] mr-2" /> Add Prize Pool`,
  `<Trophy size={16} className="text-[#e5c158] mr-2" /> View Generated Contests`
);

fs.writeFileSync('src/App.tsx', file);
console.log("FIXED UI");
