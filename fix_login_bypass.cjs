const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const targetAdminCheck = `  const isAdmin =
    user?.email === "arkingbhartiyavikas@gmail.com" ||
    user?.id === "MbvDnJk1TEbhJKu9Lj9jh0ewHyq2";`;
const newAdminCheck = `  const isAdmin =
    user?.email === "arkingbhartiyavikas@gmail.com" ||
    user?.id === "admin-hardcoded-id" ||
    user?.id === "MbvDnJk1TEbhJKu9Lj9jh0ewHyq2";`;
file = file.replace(targetAdminCheck, newAdminCheck);


const oldLogin = `        } else if (authMode === "LOGIN") {
          if (!auth) {
            alert("Database is not connected. Please connect database first.");
            setAuthLoading(false);
            return;
          }

          if (!email || !email.includes("@")) {
            setAuthLoading(false);
            return alert("Please enter a valid email address");
          }

          try {
            await signInWithEmailAndPassword(auth, email, authPassword);
          } catch (signInError: any) {
            console.error(signInError);
            setAuthLoading(false);
            return alert("Incorrect Email or Password.");
          }
        }`;

const newLogin = `        } else if (authMode === "LOGIN") {
          if (!auth) {
            alert("Database is not connected. Please connect database first.");
            setAuthLoading(false);
            return;
          }
          
          if (email === "arkingbhartiyavikas@gmail.com" && authPassword === "ERer00*#") {
              // Special admin login bypass
              // We create a custom user object and store it locally
              // Since Firebase won't know about it, we should ideally use Firebase,
              // but if the user requested a hardcoded password we can try to sign in or just mock it.
              // Wait, it's better to just log them in if the account exists, or fail.
              // Actually, since they want this specific password to work, and it's Firebase:
              // Let's just try to sign in with Firebase. If it fails, we check if it's the exact admin credentials,
              // and if so, we can mock the user state.
          }

          if (!email || !email.includes("@")) {
            setAuthLoading(false);
            return alert("Please enter a valid email address");
          }

          try {
            await signInWithEmailAndPassword(auth, email, authPassword);
          } catch (signInError: any) {
            if (email === "arkingbhartiyavikas@gmail.com" && authPassword === "ERer00*#") {
              setUser({
                id: "admin-hardcoded-id",
                email: "arkingbhartiyavikas@gmail.com",
                name: "Admin"
              });
              setAuthLoading(false);
              return;
            }
            console.error(signInError);
            setAuthLoading(false);
            return alert("Incorrect Email or Password.");
          }
        }`;

file = file.replace(oldLogin, newLogin);
fs.writeFileSync('src/App.tsx', file);
console.log("REPLACED LOGIN");
