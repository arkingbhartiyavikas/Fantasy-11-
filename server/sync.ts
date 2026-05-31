import { redis } from './redis.js';

export async function syncData(collection: string, id: string, data: any) {
  const promises = [];

  // Redis Cache (if available)
  if (redis && redis.status === 'ready') {
    promises.push(
      redis.set(`${collection}:${id}`, JSON.stringify(data)).then(() => {
        console.log(`✅ Synced to Redis [${collection}:${id}]`);
      }).catch((e) => {
        console.error(`❌ Redis Sync Error [${collection}:${id}]:`, e);
      })
    );
  }

  // NOTE: Supabase and Firebase Admin sync disabled on server to prevent errors,
  // since the client directly writes to Firestore and env vars aren't configured.

  await Promise.all(promises);
}

export async function getSyncedData(collection: string, id: string) {
   if (redis && redis.status === 'ready') {
       const cached = await redis.get(`${collection}:${id}`);
       if (cached) {
           return JSON.parse(cached);
       }
   }
   return null;
}
