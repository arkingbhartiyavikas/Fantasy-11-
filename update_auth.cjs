const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const targetAdminCheck = `  const isAdmin =
    user?.email === "arkingbhartiyavikas@gmail.com" ||
    user?.id === "admin-hardcoded-id" ||
    user?.id === "MbvDnJk1TEbhJKu9Lj9jh0ewHyq2";`;
const newAdminCheck = `  const isAdmin =
    user?.email === "arkingbhartiyavikas@gmail.com" ||
    user?.id === "admin-hardcoded-id";`;
file = file.replace(targetAdminCheck, newAdminCheck);

fs.writeFileSync('src/App.tsx', file);
console.log("UPDATED ADMIN CHECK");
