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

export type PreferenceKey =
  | "taskAssigned"
  | "deadlineReminder"
  | "chatMention"
  | "testAssigned"
  | "contributionReq";

// Types that really exist in your Prisma enum
const VALID_TYPES = new Set<string>(Object.values(NotificationType));
// Known to exist (used elsewhere in your code); used when a type isn't in the enum
const FALLBACK_TYPE = NotificationType.TASK_STATUS_CHANGED;

const resolveType = (type: NotificationType): NotificationType => {
  if (VALID_TYPES.has(type)) return type;
  console.warn(
    `[NotificationService] "${type}" is not in the NotificationType enum, using ${FALLBACK_TYPE}. Add it to schema.prisma to fix.`
  );
  return FALLBACK_TYPE;
};

const createNotification = async (payload: ICreateNotification) => {
  return prisma.notification.create({
    data: {
      userId: payload.userId,
      type: resolveType(payload.type),
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

  const type = resolveType(data.type);

  return prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title: data.title,
      body: data.body,
      channel: data.channel || NotificationChannel.IN_APP,
      entityType: data.entityType,
      entityId: data.entityId,
      metadata: data.metadata || {},
    })),
  });
};

// Removes users who turned off in-app notifications (or the given type)
const filterByPreference = async (userIds: string[], key?: PreferenceKey) => {
  if (userIds.length === 0) return [];

  const blocked = await prisma.notificationPreference.findMany({
    where: {
      userId: { in: userIds },
      OR: [
        { inAppEnabled: false },
        ...(key ? [{ [key]: false } as Prisma.NotificationPreferenceWhereInput] : []),
      ],
    },
    select: { userId: true },
  });

  const blockedIds = new Set(blocked.map((b) => b.userId));
  return userIds.filter((id) => !blockedIds.has(id));
};

// Preference-aware, never throws: a failed notification must not break the main action
const notifySafe = async (payload: ICreateNotification, key?: PreferenceKey) => {
  try {
    const [allowed] = await filterByPreference([payload.userId], key);
    if (!allowed) return null;
    return await createNotification(payload);
  } catch (error) {
    console.error("[NotificationService.notifySafe]", error);
    return null;
  }
};

// Bulk version of notifySafe (one insert for all allowed users)
const notifyManySafe = async (
  userIds: string[],
  data: Omit<ICreateNotification, "userId">,
  key?: PreferenceKey
) => {
  try {
    const targets = await filterByPreference([...new Set(userIds)], key);
    if (targets.length === 0) return null;
    return await createManyNotifications(targets, data);
  } catch (error) {
    console.error("[NotificationService.notifyManySafe]", error);
    return null;
  }
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
  notifySafe,
  notifyManySafe,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};