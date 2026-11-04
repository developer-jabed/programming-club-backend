import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { AnalyticsController } from "./analytics.controller.js";
import auth from "../../middlewares/auth.middleware.js";

export default async function analyticsRoutes(fastify: FastifyInstance) {
  // Main dashboard stats
  fastify.get(
    "/dashboard",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    AnalyticsController.getDashboardStats
  );

  // Recent activities
  fastify.get(
    "/recent-activities",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    AnalyticsController.getRecentActivities
  );

  // Leaderboard (public for members too)
  fastify.get(
    "/leaderboard",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)],
    },
    AnalyticsController.getLeaderboard
  );

  // Project stats
  fastify.get(
    "/projects",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    AnalyticsController.getProjectStats
  );

  // Monthly growth
  fastify.get(
    "/growth",
    {
      preHandler: [auth(UserRole.ADMIN)],
    },
    AnalyticsController.getMonthlyGrowth
  );

  // Sector stats
  fastify.get(
    "/sectors",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    AnalyticsController.getSectorStats
  );
}