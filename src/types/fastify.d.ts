import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { Server } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
    smsQueue: Queue;
    io: Server;               // ← Added this
  }
}