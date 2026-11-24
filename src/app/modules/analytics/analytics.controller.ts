import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { AnalyticsService } from "./analytics.service.js";
import sendResponse from "../../shared/sendResponse.js";

const getDashboardStats = async (req: FastifyRequest, reply: FastifyReply) => {
  const result = await AnalyticsService.getDashboardStats();

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard stats retrieved successfully",
    data: result,
  });
};

const getRecentActivities = async (req: FastifyRequest, reply: FastifyReply) => {
  const limit = Number((req.query as any).limit) || 10;
  const result = await AnalyticsService.getRecentActivities(limit);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Recent activities retrieved successfully",
    data: result,
  });
};

/**
 * GET /leaderboard
 * Query: period (7d | 30d | 90d | this_month | last_month | all_time),
 *        limit, offset, group, semester
 * The logged-in user's id is passed so the response includes their own rank.
 */
const getLeaderboard = async (req: FastifyRequest, reply: FastifyReply) => {
  const query = req.query as {
    period?: string;
    limit?: string;
    offset?: string;
    group?: string;
    semester?: string;
  };

  // depending on your auth middleware the id may be `id` or `userId`
  const user = (req as any).user as { id?: string; userId?: string } | undefined;

  const result = await AnalyticsService.getLeaderboard({
    period: query.period,
    limit: query.limit,
    offset: query.offset,
    group: query.group,
    semester: query.semester,
    userId: user?.id ?? user?.userId,
  });

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Leaderboard retrieved successfully",
    data: result,
  });
};

const getProjectStats = async (req: FastifyRequest, reply: FastifyReply) => {
  const result = await AnalyticsService.getProjectStats();

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project stats retrieved successfully",
    data: result,
  });
};

const getSectorStats = async (req: FastifyRequest, reply: FastifyReply) => {
  const result = await AnalyticsService.getSectorStats();

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sector stats retrieved successfully",
    data: result,
  });
};

const getMonthlyGrowth = async (req: FastifyRequest, reply: FastifyReply) => {
  const result = await AnalyticsService.getMonthlyGrowth();

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Monthly growth retrieved successfully",
    data: result,
  });
};

export const AnalyticsController = {
  getDashboardStats,
  getRecentActivities,
  getLeaderboard,
  getSectorStats,
  getProjectStats,
  getMonthlyGrowth,
};