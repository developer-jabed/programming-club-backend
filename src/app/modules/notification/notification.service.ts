import { Prisma, NotificationType, NotificationChannel } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";
import { prisma } from "../../shared/prisma.js";
import type { ICreateNotification, INotificationFilter } from "./notification.interface.js";

const createNotification = async (payload: ICreateNotification) => {
  return prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      channel: payload.channel || NotificationChannel.IN_APP,
      entityType: payload.entityType,
      entityId: payload.entityId,
      metadata: payload.metadata || {},
    },
  });
};

// Helper to create notification for multiple users
const createManyNotifications = async (
  userIds: string[],
  data: Omit<ICreateNotification, "userId">
) => {
  if (userIds.length === 0) return;

  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: data.type,
      title: data.title,
      body: data.body,
      channel: data.channel || NotificationChannel.IN_APP,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata || {},
    })),
  });
};

const getMyNotifications = async (
  userId: string,
  filters: INotificationFilter,
  query: PaginationQuery
) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(filters.isRead !== undefined && { isRead: filters.isRead }),
    ...(filters.type && { type: filters.type }),
  };

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

const getUnreadCount = async (userId: string) => {
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
};

const markAsRead = async (notificationId: string, userId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }

  if (notification.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "You cannot access this notification");
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
};

const markAllAsRead = async (userId: string) => {
  return prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });
};

const deleteNotification = async (notificationId: string, userId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new ApiError(httpStatus.NOT_FOUND, "Notification not found");
  }

  if (notification.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "You cannot delete this notification");
  }

  return prisma.notification.delete({
    where: { id: notificationId },
  });
};

export const NotificationService = {
  createNotification,
  createManyNotifications,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};