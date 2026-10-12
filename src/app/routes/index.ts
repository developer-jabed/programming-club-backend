import type { FastifyInstance } from "fastify";
import userRoutes from "../modules/user/user.route.js";
import authRoutes from "../modules/auth/auth.route.js";


async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Health Check
  fastify.get("/health", async () => ({
    success: true,
    status: "OK",
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  }));


  fastify.register(userRoutes, {
    prefix: "/users"
  });

  fastify.register(authRoutes, {
    prefix: "/auth"
  });
}

export default registerRoutes;