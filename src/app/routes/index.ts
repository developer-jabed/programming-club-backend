import type { FastifyInstance } from "fastify";
import userRoutes from "../modules/user/user.route.js";
import authRoutes from "../modules/auth/auth.route.js";
import projectRoutes from "../modules/project/project.route.js";
import taskRoutes from "../modules/task/task.route.js";
import testRoutes from "../modules/test/test.route.js";
import chatRoutes from "../modules/chat/chat.route.js";
import notificationRoutes from "../modules/notification/notification.route.js";
import submissionRoutes from "../modules/submission/submission.route.js";
import analyticsRoutes from "../modules/analytics/analytics.route.js";
import sectorRoutes from "../modules/sector/sector.route.js";


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

  fastify.register(projectRoutes, {
    prefix: "/projects"
  });

  fastify.register(taskRoutes, {
    prefix: "/tasks"
  });

  fastify.register(testRoutes, {
    prefix: "/tests"
  });


  fastify.register(notificationRoutes, {
    prefix: "/notifications"
  });

  fastify.register(chatRoutes, {
    prefix: "/chat"
  });

  fastify.register(submissionRoutes, {
    prefix: "/submissions"
  })


  fastify.register(analyticsRoutes, {
    prefix: "/analytics"
  })

  fastify.register(sectorRoutes, {
    prefix: "/sectors"
  });
}

export default registerRoutes;