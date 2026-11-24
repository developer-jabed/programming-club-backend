import { Prisma, NotificationType } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";
import { prisma } from "../../shared/prisma.js";
import { NotificationService } from "../notification/notification.service.js";
import type { ISendMessage } from "./chat.interface.js";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Extract @mentions from message content (simple @username pattern) */
const extractMentions = (content: string): string[] => {
  const matches = content.match(/@(\w+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
};

/** Get all active member IDs of a project except the sender */
const getOtherActiveMemberIds = async (
  projectId: string,
  excludeUserId: string
): Promise<string[]> => {
  const members = await prisma.projectMember.findMany({
    where: {
      projectId,
      status: "ACTIVE",
      userId: { not: excludeUserId },
    },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
};

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

const sendMessage = async (
  projectId: string,
  senderId: string,
  payload: ISendMessage
) => {
  // Check if user is a member of the project
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId: senderId },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new ApiError(httpStatus.FORBIDDEN, "You are not a member of this project");
  }

  // Get project title for nicer notification body
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { title: true },
  });

  const message = await prisma.chatMessage.create({
    data: {
      projectId,
      senderId,
      content: payload.content,
      replyToId: payload.replyToId,
      attachments: payload.attachments || [],
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          profilePicture: true,
          role: true,
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          senderId: true,
          sender: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  // ── Classy Notifications (non-blocking) ────────────────────
  void (async () => {
    try {
      const senderName = message.sender.name;
      const projectTitle = project?.title ?? "the project";
      const preview =
        payload.content.length > 80
          ? payload.content.slice(0, 80) + "…"
          : payload.content;

      // 1. Handle @mentions first (higher priority)
      const mentionedUsernames = extractMentions(payload.content);
      let mentionedUserIds: string[] = [];

      if (mentionedUsernames.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: {
            // assuming username or name is used for @mentions
            // Adjust this field according to your User model
            OR: [
              { name: { in: mentionedUsernames, mode: "insensitive" } },
              // { username: { in: mentionedUsernames, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });

        mentionedUserIds = mentionedUsers
          .map((u) => u.id)
          .filter((id) => id !== senderId);

        if (mentionedUserIds.length > 0) {
          await NotificationService.notifyManySafe(
            mentionedUserIds,
            {
              type: NotificationType.CHAT_MENTION,
              title: `${senderName} mentioned you`,
              body: `In ${projectTitle}: "${preview}"`,
              entityType: "ChatMessage",
              entityId: message.id,
              metadata: {
                projectId,
                messageId: message.id,
                senderId,
                isMention: true,
              },
            },
            "chatMention" // respects preference
          );
        }
      }

      // 2. If this is a reply → notify the original author
      if (message.replyTo && message.replyTo.senderId !== senderId) {
        // Avoid double-notifying if already mentioned
        if (!mentionedUserIds.includes(message.replyTo.senderId)) {
          await NotificationService.notifySafe(
            {
              userId: message.replyTo.senderId,
              type: NotificationType.CHAT_MESSAGE,
              title: `${senderName} replied to you`,
              body: `In ${projectTitle}: "${preview}"`,
              entityType: "ChatMessage",
              entityId: message.id,
              metadata: {
                projectId,
                messageId: message.id,
                replyToId: message.replyToId,
                senderId,
              },
            }
            // no specific preference key → only respects inAppEnabled
          );
        }
      }

      // 3. Notify all other active members about the new message
      //    (exclude sender + people already notified via mention/reply)
      const allOtherMembers = await getOtherActiveMemberIds(projectId, senderId);
      const alreadyNotified = new Set([
        ...mentionedUserIds,
        ...(message.replyTo ? [message.replyTo.senderId] : []),
      ]);

      const remainingMembers = allOtherMembers.filter(
        (id) => !alreadyNotified.has(id)
      );

      if (remainingMembers.length > 0) {
        await NotificationService.notifyManySafe(remainingMembers, {
          type: NotificationType.CHAT_MESSAGE,
          title: `New message in ${projectTitle}`,
          body: `${senderName}: ${preview}`,
          entityType: "ChatMessage",
          entityId: message.id,
          metadata: {
            projectId,
            messageId: message.id,
            senderId,
          },
        });
      }
    } catch (err) {
      console.error("[ChatService.sendMessage] notification error:", err);
    }
  })();

  return message;
};

const getProjectMessages = async (
  projectId: string,
  userId: string,
  query: PaginationQuery
) => {
  // Verify membership
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new ApiError(httpStatus.FORBIDDEN, "You are not a member of this project");
  }

  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);

  const [data, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      skip,
      take,
      orderBy: { createdAt: "desc" }, // newest first (frontend can reverse)
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
            role: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            sender: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    prisma.chatMessage.count({
      where: { projectId, deletedAt: null },
    }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data: data.reverse(), // return oldest → newest for chat UI
  };
};

const deleteMessage = async (messageId: string, userId: string) => {
  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new ApiError(httpStatus.NOT_FOUND, "Message not found");
  }

  if (message.senderId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "You can only delete your own messages");
  }

  // Soft delete
  return prisma.chatMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });
};

export const ChatService = {
  sendMessage,
  getProjectMessages,
  deleteMessage,
};