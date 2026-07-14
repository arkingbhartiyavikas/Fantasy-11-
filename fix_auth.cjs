const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

const startIdx = file.indexOf('const handleAuth = async (e?: React.FormEvent) => {');
const endMarker = '    return (\n      <div\n        className={`relative h-[100dvh] w-full max-w-md mx-auto';
const endIdx = file.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
    const toReplace = file.substring(startIdx, endIdx);
    // Find the end of the handleAuth function block which should be exactly before the return of renderLogin
    
    // We will construct the new handleAuth text
    const newHandleAuth = `const handleAuth = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();

      setAuthLoading(true);
      try {
        const email = authInput.trim().toLowerCase();

        if (authMode === "SIGNUP") {
          sessionStorage.setItem("isSigningUp", "true");

          if (!email || !email.includes("@")) {
            setAuthLoading(false);
            return alert("Please enter a valid email address");
          }
          if (authPassword.length < 6) {
            setAuthLoading(false);
            return alert("Password must be at least 6 characters");
          }

          let supaUserId = null;

          if (!auth) {
            alert("Database is not connected. Please connect database first.");
            setAuthLoading(false);
            return;
          }

          // 1. Create User in Firebase
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            email,
            authPassword,
          );

          if (userCredential?.user) {
            supaUserId = userCredential.user.uid;
          }

          if (supaUserId) {
            const numericId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            // Write to Firestore using Firebase UID
            await setDoc(doc(db, "users", supaUserId), {
              name: "Fantasy Player",
              mobile: numericId, // User ID is stored in mobile field for backward compatibility
              email: email,
              numericId: numericId,
              createdAt: new Date().toISOString(),
              balance: 0,
              winnings: 0,
              bonus: 100, // Welcome bonus
              bonusExpiry: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              isBot: false,
              supaId: supaUserId, // Link to Supabase User ID
            });

            // Link mobile doc for quick auth check
            await setDoc(doc(db, "users", numericId), {
              userId: numericId,
              mobile: numericId,
              email: email,
              name: "Fantasy Player",
              avatar: 1,
              createdAt: new Date().toISOString(),
            });
          }

          localStorage.setItem("dreamApp_hasSignedUp", "true");
          // Since signup also logs in automatically via Supabase, we are done
          sessionStorage.removeItem("isSigningUp");
        } else if (authMode === "LOGIN") {
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
        }
      } catch (error: any) {
        console.error("Auth Error", error);
        setAuthLoading(false);
        if (error.code === "auth/email-already-in-use") {
          alert("This email is already registered. Please login.");
        } else {
          alert("Auth Error: " + error.message);
        }
      }
    };

    if (oneClickCreds) {
      return (
        <div
          className={\`relative h-[100dvh] w-full max-w-md mx-auto bg-app-bg text-app-text font-sans shadow-2xl overflow-hidden border-x border-app-border flex flex-col \${themeMode === "Light" ? "theme-light" : ""} color-\${themeColor.toLowerCase()}\`}
        >
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            <div className="w-24 h-24 bg-green-500 rounded-full mb-8 flex items-center justify-center shadow-lg shadow-green-500/20">
              <Check size={48} className="text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-2 text-center text-app-text">
              Account Generated!
            </h1>
            <p className="text-sm text-app-text-muted text-center mb-10 max-w-[280px]">
              We've created a unique User ID and Password for you.
              <br />
              <span className="text-app-accent font-bold mt-2 block">
                Please save these details.
              </span>
            </p>

            <div className="w-full bg-app-card border border-app-border rounded-xl p-5 mb-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-app-accent/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
              
              <p className="text-xs text-app-text-muted font-bold uppercase tracking-wider mb-1">
                Your Email Address
              </p>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xl font-bold tracking-widest text-app-text">
                  {oneClickCreds.userId}@fantasy11.local
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(oneClickCreds.userId + "@fantasy11.local").catch(e => console.error("clipboard error", e));
                    alert("Email Copied!");
                  }}
                  className="p-2 bg-app-bg rounded border border-app-border text-app-text hover:text-white transition-colors"
                >
                  <Copy size={16} />
                </button>
              </div>

              <div className="w-full h-[1px] bg-app-border mb-6"></div>

              <p className="text-xs text-app-text-muted font-bold uppercase tracking-wider mb-1">
                Your Password
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold tracking-widest text-[#FF3B5C]">
                  {oneClickCreds.pass}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(oneClickCreds.pass).catch(e => console.error("clipboard error", e));
                    alert("Password Copied!");
                  }}
                  className="p-2 bg-app-bg rounded border border-app-border text-app-text hover:text-white transition-colors"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <button
              onClick={async () => {
                setOneClickCreds(null);
                // the user is already authenticated behind the scenes by \`createUserWithEmailAndPassword\`
              }}
              className="w-full bg-app-accent text-white font-black py-4 rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-sm"
            >
              Login Now
            </button>
          </div>
        </div>
      );
    }
`;

    file = file.substring(0, startIdx) + newHandleAuth + file.substring(endIdx);
    fs.writeFileSync('src/App.tsx', file);
    console.log("REPLACED HANDLEAUTH");
} else {
    console.log("NOT FOUND");
}
