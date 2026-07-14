const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const targetOnAuth = `    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {`;

const newOnAuth = `    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      // Allow hardcoded admin session to persist if it was set via our special bypass
      const savedUserStr = localStorage.getItem("dreamApp_user");
      let isSpecialAdmin = false;
      try {
          if (savedUserStr) {
              const p = JSON.parse(savedUserStr);
              if (p?.id === "admin-hardcoded-id") {
                  isSpecialAdmin = true;
                  setUser(p);
                  setAuthInitialized(true);
                  return;
              }
          }
      } catch(e) {}

      if (fbUser) {`;

file = file.replace(targetOnAuth, newOnAuth);
fs.writeFileSync('src/App.tsx', file);
console.log("UPDATED AUTH OBSERVER");
