import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCJ242ctyQ3rsJAzr1G2Eh4Fe1fdCwJO6w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "fantasy11arking.online",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "fantasy-11online",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "fantasy-11online.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "504797070449",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:504797070449:web:7dcf2c8ab484c95ce587d0",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-L31CCE9SK6"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
} as any);
export const auth = getAuth(app);
