import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { NotificationService } from "./notification.service.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../helper/pick.js";
import type { JwtPayload } from "../auth/auth.interface.js";

const getMyNotifications = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;

  const filters = pick(req.query as any, ["isRead", "type"]);
  // Convert string "true"/"false" to boolean
  if (filters.isRead !== undefined) {
    filters.isRead = filters.isRead === "true";
  }

  const result = await NotificationService.getMyNotifications(
    user.id,
    filters,
    req.query as any
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getUnreadCount = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const count = await NotificationService.getUnreadCount(user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Unread count retrieved",
    data: { count },
  });
};

const markAsRead = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };

  const result = await NotificationService.markAsRead(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: result,
  });
};

const markAllAsRead = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  await NotificationService.markAllAsRead(user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All notifications marked as read",
  });
};

const deleteNotification = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };

  await NotificationService.deleteNotification(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification deleted successfully",
  });
};

export const NotificationController = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};