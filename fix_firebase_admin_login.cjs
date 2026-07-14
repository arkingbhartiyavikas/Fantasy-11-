const fs = require('fs');
let file = fs.readFileSync('src/App.tsx', 'utf8');

// I also need to make sure the user state is set correctly in App.tsx
// It's probably a state `const [user, setUser] = useState<any>(null);`
