import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { NotificationController } from "./notification.controller.js";
import auth from "../../middlewares/auth.middleware.js";

const ALL_ROLES = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER];

export default async function notificationRoutes(fastify: FastifyInstance) {
  // Get my notifications
  fastify.get(
    "/",
    { preHandler: [auth(...ALL_ROLES)] },
    NotificationController.getMyNotifications
  );

  // Get unread count
  fastify.get(
    "/unread-count",
    { preHandler: [auth(...ALL_ROLES)] },
    NotificationController.getUnreadCount
  );

  // Mark single as read
  fastify.patch(
    "/:id/read",
    { preHandler: [auth(...ALL_ROLES)] },
    NotificationController.markAsRead
  );

  // Mark all as read
  fastify.patch(
    "/read-all",
    { preHandler: [auth(...ALL_ROLES)] },
    NotificationController.markAllAsRead
  );

  // Delete notification
  fastify.delete(
    "/:id",
    { preHandler: [auth(...ALL_ROLES)] },
    NotificationController.deleteNotification
  );
}