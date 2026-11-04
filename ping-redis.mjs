import 'dotenv/config';
import { Redis } from 'ioredis';

const u = process.env.BULLMQ_REDIS_URL;
if (!u) {
  console.error('BULLMQ_REDIS_URL missing');
  process.exit(1);
}
console.log('URL:', u.replace(/:([^:@/]+)@/, ':****@'));
const r = new Redis(u, { connectTimeout: 10000, maxRetriesPerRequest: 1 });
try {
  const p = await r.ping();
  console.log('OK PING', p);
  await r.quit();
} catch (e) {
  console.error('FAIL', e.message);
  process.exit(1);
}
