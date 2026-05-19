import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

// Setup Redis instance
let redisInstance: Redis | null = null;
try {
  if (redisUrl) {
    redisInstance = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 1) {
          return null; // Stop retrying
        }
        return 1000;
      }
    });
  }
} catch (e) {
  console.error("❌ Invalid REDIS_URL provided, Redis is disabled.");
}

export const redis = redisInstance;

if (redis) {
  redis.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  redis.on('error', (err) => {
    // Only log once and don't crash
    if (!redis.status || redis.status === 'connecting') {
      // Redis is not running or accessible, silently fall back
      redis.disconnect();
    }
  });
} else {
  console.log('⚠️ Redis URL not provided, Redis caching/queues will be disabled.');
}
