import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { Server } from "socket.io";
import type { JwtPayload } from "../app/helper/jwtHelper.js";

declare module "fastify" {
  interface FastifyInstance {
    redis?: Redis;
    smsQueue: Queue;
    io: Server;
  }

  interface FastifyRequest {
    user?: JwtPayload;
  }
}

declare module "socket.io" {
  interface Socket {
    user?: JwtPayload;
  }
}
