import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

let db: admin.firestore.Firestore | null = null;
let realtimeDb: admin.database.Database | null = null;
let storage: admin.storage.Storage | null = null;

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccountParams = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountParams),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    } else {
      console.warn("⚠️  FIREBASE_SERVICE_ACCOUNT_KEY is missing. Using default credentials, this might fail without App Default Credentials and proper ENV setup.");
      admin.initializeApp({
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    }
  }
  
  db = admin.firestore();
  try {
     realtimeDb = admin.database();
  } catch (e) {
     console.warn("⚠️  Firebase Realtime DB not available or configured.");
  }
  storage = admin.storage();
  
  console.log('✅ Firebase Admin connected successfully');
} catch (error) {
  console.error("❌ Firebase Admin initialization error:", error);
}

export const firebaseAdmin = {
    db,
    realtimeDb,
    storage,
    admin
};
