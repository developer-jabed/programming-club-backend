import { Prisma } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";
import { prisma } from "../../shared/prisma.js";
import type { ISendMessage } from "./chat.interface.js";

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
          sender: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

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