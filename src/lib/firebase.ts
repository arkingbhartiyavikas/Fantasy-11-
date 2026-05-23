import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCJ242ctyQ3rsJAzr1G2Eh4Fe1fdCwJO6w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "fantasy-11online.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "fantasy-11online",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "fantasy-11online.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "504797070449",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:504797070449:web:7dcf2c8ab484c95ce587d0",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L31CCE95K6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
