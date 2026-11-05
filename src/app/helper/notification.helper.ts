import {
  NotificationChannel,
  NotificationType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../shared/prisma.js";

// ⚠ Must match your Prisma `NotificationType` enum. Check with:
//   grep -n -A15 "enum NotificationType" prisma/schema.prisma
export const NOTIFY = {
  CONTRIBUTION_REQUEST: "CONTRIBUTION_REQUEST" as NotificationType,
  CONTRIBUTION_RESPONSE: "CONTRIBUTION_REQUEST" as NotificationType, // change if you have a separate value
  SECTOR_ASSIGNED: "SECTOR_ASSIGNED" as NotificationType, // add to enum or point to an existing value
  SECTOR_REMOVED: "SECTOR_REMOVED" as NotificationType, // add to enum or point to an existing value
};

type PreferenceKey =
  | "taskAssigned"
  | "deadlineReminder"
  | "chatMention"
  | "testAssigned"
  | "contributionReq";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  preferenceKey?: PreferenceKey;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Creates an in-app notification if the user's preferences allow it.
 * Never throws: a failed notification must not break the main action.
 */
export const createNotification = async (input: CreateNotificationInput) => {
  try {
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId: input.userId },
    });

    if (pref) {
      if (!pref.inAppEnabled) return null;
      if (input.preferenceKey && !pref[input.preferenceKey]) return null;
    }

    return await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        channel: NotificationChannel.IN_APP,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    console.error("[createNotification]", error);
    return null;
  }
};