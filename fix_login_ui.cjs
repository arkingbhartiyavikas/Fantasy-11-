const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Update the input field
const oldInput = `<input
                      type="text"
                      placeholder="User ID (10 digits)"
                      maxLength={10}
                      value={authInput}
                      onChange={(e) =>
                        setAuthInput(e.target.value.replace(/\\D/g, ""))
                      }`;

const newInput = `<input
                      type="email"
                      placeholder="Email Address"
                      value={authInput}
                      onChange={(e) => setAuthInput(e.target.value)}`;

file = file.replace(oldInput, newInput);

// 2. Remove the OR separator and the Google/One-Click buttons
const startOr = file.indexOf('<div className="relative flex items-center py-6">');
const endOr = file.indexOf('</button>\n          </div>\n\n          <p className="text-[10px] text-app-text-muted text-center mt-12 px-6 leading-relaxed">');

if (startOr !== -1 && endOr !== -1) {
    file = file.substring(0, startOr) + '          </div>\n\n          <p className="text-[10px] text-app-text-muted text-center mt-12 px-6 leading-relaxed">' + file.substring(endOr + '</button>\n          </div>\n\n          <p className="text-[10px] text-app-text-muted text-center mt-12 px-6 leading-relaxed">'.length);
}

fs.writeFileSync('src/App.tsx', file);
console.log("REPLACED LOGIN UI");
