import { z } from "zod";
import { NotificationType } from "@prisma/client";

export const getNotificationsSchema = z.object({
  query: z.object({
    isRead: z.enum(["true", "false"]).optional(),
    type: z.nativeEnum(NotificationType).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const NotificationValidation = {
  getNotificationsSchema,
};