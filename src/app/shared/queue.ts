import fp from "fastify-plugin";
import { Queue, type ConnectionOptions } from "bullmq";
import { Redis } from "ioredis";
import type { FastifyInstance } from "fastify";

export default fp(async (fastify: FastifyInstance) => {
  const redisUrl = process.env.BULLMQ_REDIS_URL;
  if (!redisUrl) {
    throw new Error("BULLMQ_REDIS_URL is required");
  }

  const safeUrl = redisUrl.replace(/:([^:@/]+)@/, ":****@");
  console.log("[Redis] Connecting to:", safeUrl);

  const pingClient = new Redis(redisUrl, {
    connectTimeout: 10_000,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  const started = Date.now();
  try {
    await pingClient.connect();
    const pong = await pingClient.ping();
    const ms = Date.now() - started;
    console.log(`[Redis] ✅ PING → ${pong} (${ms}ms)`);
    fastify.log.info({ ms, pong }, "✅ Redis connected");
  } catch (err: unknown) {
    const ms = Date.now() - started;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Redis] ❌ PING failed (${ms}ms):`, msg);
    fastify.log.warn({ err: msg, ms }, "⚠️ Redis connection failed – queues may not work");
  } finally {
    try {
      await pingClient.quit();
    } catch {
      pingClient.disconnect();
    }
  }

  const connection: ConnectionOptions = {
    url: redisUrl,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 10_000,
  };

  const smsQueue = new Queue("result-sms", { connection });
  fastify.decorate("smsQueue", smsQueue);

  fastify.addHook("onClose", async () => {
    await smsQueue.close();
  });
});