require('dotenv').config();
const Redis = require('ioredis');
const u = process.env.BULLMQ_REDIS_URL;
if (!u) {
  console.error('BULLMQ_REDIS_URL missing');
  process.exit(1);
}
console.log('URL:', u.replace(/:([^:@/]+)@/, ':****@'));
const r = new Redis(u, { connectTimeout: 10000, maxRetriesPerRequest: 1 });
r.ping()
  .then(function (p) {
    console.log('OK PING', p);
    return r.quit();
  })
  .catch(function (e) {
    console.error('FAIL', e.message);
    process.exit(1);
  });
