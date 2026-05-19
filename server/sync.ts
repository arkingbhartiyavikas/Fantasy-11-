import { supabase } from './supabase.js';
import { redis } from './redis.js';
import { firebaseAdmin } from './firebaseAdmin.js';

/**
 * Synchronize data across all three databases:
 * 1. Redis (In-memory/Cache)
 * 2. Supabase (PostgreSQL)
 * 3. Firebase (Firestore / Realtime Database)
 */

export async function syncData(collection: string, id: string, data: any) {
  const promises = [];

  // 1. Redis (Cache/Queue Database)
  if (redis && redis.status === 'ready') {
    promises.push(
      redis.set(`${collection}:${id}`, JSON.stringify(data)).then(() => {
        console.log(`✅ Synced to Redis [${collection}:${id}]`);
      }).catch((e) => {
        console.error(`❌ Redis Sync Error [${collection}:${id}]:`, e);
      })
    );
  }

  // 2. Supabase (PostgreSQL Database Backup)
  if (supabase) {
    promises.push(
      // We assume a generic 'backups' table or specific tables. 
      // Using a generic 'sync_records' to represent arbitrary data if tables aren't predefined,
      // or attempting to upsert to the specific collection table.
      supabase
        .from(collection) // This assumes you have tables created in Supabase matching the collection names
        .upsert({ id, ...data })
        .then(({ error }) => {
          if (error) {
            console.error(`❌ Supabase Sync Error [${collection}:${id}]:`, error.message);
            // Fallback: Dump to a generic key-value backups table
            return supabase.from('universal_backups').upsert({ id: `${collection}_${id}`, collection_name: collection, payload: data });
          } else {
            console.log(`✅ Synced to Supabase [${collection}:${id}]`);
          }
        }).catch((e) => {
            console.error(`❌ Supabase Fetch Error [${collection}:${id}]:`, e);
        })
    );
  }

  // 3. Firebase Firestore & Realtime Database
  if (firebaseAdmin.db) {
    promises.push(
      firebaseAdmin.db.collection(collection).doc(id).set(data, { merge: true }).then(() => {
        console.log(`✅ Synced to Firestore [${collection}:${id}]`);
      }).catch((e) => {
        console.error(`❌ Firestore Sync Error [${collection}:${id}]:`, e);
      })
    );
  }

  if (firebaseAdmin.realtimeDb) {
    promises.push(
      firebaseAdmin.realtimeDb.ref(`${collection}/${id}`).set(data).then(() => {
         console.log(`✅ Synced to Firebase Realtime DB [${collection}:${id}]`);
      }).catch((e) => {
         console.error(`❌ Firebase Realtime DB Sync Error [${collection}:${id}]:`, e.message);
      })
    );
  }

  await Promise.all(promises);
  console.log(`🚀 Triple-Sync completed for ${collection}:${id}`);
}

export async function getSyncedData(collection: string, id: string) {
   // Try Redis first
   if (redis && redis.status === 'ready') {
       const cached = await redis.get(`${collection}:${id}`);
       if (cached) {
           console.log(`⚡ Retrieved from Redis [${collection}:${id}]`);
           return JSON.parse(cached);
       }
   }
   
   // Try Supabase next
   if (supabase) {
       const { data, error } = await supabase.from(collection).select('*').eq('id', id).single();
       if (!error && data) {
           console.log(`⚡ Retrieved from Supabase [${collection}:${id}]`);
           // Cache it back to Redis
           if (redis && redis.status === 'ready') redis.set(`${collection}:${id}`, JSON.stringify(data));
           return data;
       }
   }

   // Last resort: Firestore
   if (firebaseAdmin.db) {
       const docSnap = await firebaseAdmin.db.collection(collection).doc(id).get();
       if (docSnap.exists) {
           console.log(`⚡ Retrieved from Firestore [${collection}:${id}]`);
           const data = docSnap.data();
           // Cache it back to Redis
           if (redis && redis.status === 'ready') redis.set(`${collection}:${id}`, JSON.stringify(data));
           return data;
       }
   }

   return null;
}
