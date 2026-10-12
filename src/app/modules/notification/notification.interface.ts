import { NotificationType, NotificationChannel } from "@prisma/client";

export type INotificationFilter = {
  isRead?: boolean;
  type?: NotificationType;
};

export type ICreateNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  channel?: NotificationChannel;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
};