import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCJ242ctyQ3rsJAzr1G2Eh4Fe1fdCwJO6w",
  authDomain: "fantasy-11online.firebaseapp.com",
  projectId: "fantasy-11online",
  storageBucket: "fantasy-11online.firebasestorage.app",
  messagingSenderId: "504797070449",
  appId: "1:504797070449:web:7dcf2c8ab484c95ce587d0",
  measurementId: "G-L31CCE9SK6"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
} as any);
export const auth = getAuth(app);
