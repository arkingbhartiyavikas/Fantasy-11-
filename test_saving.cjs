const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const loginCheck = `        } else if (authMode === "LOGIN") {
          if (!auth) {
            alert("Database is not connected. Please connect database first.");
            setAuthLoading(false);
            return;
          }
          
          if (email === "arkingbhartiyavikas@gmail.com" && authPassword === "ERer00*#") {`;

console.log(file.includes(loginCheck) ? "Login bypass found" : "Login bypass NOT found");
