import { Prisma, UserRole, FeatureRequestStatus, NotificationType } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import { prisma } from "../../shared/prisma.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";
import type {
  ICreateFeatureRequest,
  IUpdateFeatureRequest,
  ICreateFeatureRequestReply,
  ICreateFeatureUpdate,
  IUpdateFeatureUpdate,
  IFeatureRequestQuery,
} from "./feature.interface.js";
import { NotificationService } from "../notification/notification.service.js"; // ← add this

const isAdminRole = (role: string) =>
  role === UserRole.ADMIN || role === UserRole.MODERATOR;

/** Normalize list/detail shape: expose votes + hasVoted */
const mapRequest = (r: any) => {
  const hasVoted = Array.isArray(r.voteRecords) ? r.voteRecords.length > 0 : false;
  const { voteRecords, ...rest } = r;
  return {
    ...rest,
    votes: r.votes ?? 0,
    hasVoted,
  };
};

// ────────────────────────────────────────────────
// Helper: get all admin + moderator user IDs
// ────────────────────────────────────────────────
const getAdminModeratorIds = async (): Promise<string[]> => {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.ADMIN, UserRole.MODERATOR] },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
};

// ═════════════════════════════════════════════════════════════
// Feature Requests
// ═════════════════════════════════════════════════════════════

const createFeatureRequest = async (
  userId: string,
  payload: ICreateFeatureRequest
) => {
  const data = await prisma.featureRequest.create({
    data: {
      ...payload,
      createdById: userId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, profilePicture: true, role: true },
      },
      sector: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, title: true } },
      _count: { select: { replies: true } },
    },
  });

  // ── Notify admins & moderators ─────────────────────────────
  const adminIds = await getAdminModeratorIds();
  const targets = adminIds.filter((id) => id !== userId); // don't notify the creator

  if (targets.length > 0) {
    await NotificationService.notifyManySafe(
      targets,
      {
        type: NotificationType.SYSTEM,
        title: "New Feature Request",
        body: `"${data.title}" was submitted by ${data.createdBy.name}`,
        entityType: "FeatureRequest",
        entityId: data.id,
        metadata: {
          status: data.status,
          priority: data.priority,
          sectorId: data.sectorId,
          projectId: data.projectId,
        },
      }
      // no preference key → only respects inAppEnabled
    );
  }

  return { ...data, votes: 0, hasVoted: false };
};

const getFeatureRequests = async (
  filters: IFeatureRequestQuery & PaginationQuery,
  currentUser?: { id: string; role: string }
) => {
  // ... keep your existing implementation unchanged ...
  const pagination = calculatePagination(filters, "createdAt");
  const { skip, take, sortBy, sortOrder } = pagination;

  const andConditions: Prisma.FeatureRequestWhereInput[] = [];

  if (filters.status) andConditions.push({ status: filters.status });
  if (filters.priority) andConditions.push({ priority: filters.priority });
  if (filters.sectorId) andConditions.push({ sectorId: filters.sectorId });
  if (filters.projectId) andConditions.push({ projectId: filters.projectId });
  if (filters.createdById)
    andConditions.push({ createdById: filters.createdById });

  if (filters.search) {
    andConditions.push({
      OR: [
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.FeatureRequestWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [rows, total] = await Promise.all([
    prisma.featureRequest.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        createdBy: {
          select: { id: true, name: true, profilePicture: true, role: true },
        },
        resolvedBy: {
          select: { id: true, name: true, profilePicture: true },
        },
        sector: { select: { id: true, name: true, slug: true } },
        project: { select: { id: true, title: true } },
        _count: { select: { replies: true } },
        ...(currentUser?.id
          ? {
              voteRecords: {
                where: { userId: currentUser.id },
                select: { id: true },
                take: 1,
              },
            }
          : {}),
      },
    }),
    prisma.featureRequest.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, pagination),
    data: rows.map(mapRequest),
  };
};

const getFeatureRequestById = async (
  id: string,
  currentUser?: { id: string; role: string }
) => {
  // ... keep existing implementation unchanged ...
  const data = await prisma.featureRequest.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { id: true, name: true, profilePicture: true, role: true },
      },
      resolvedBy: {
        select: { id: true, name: true, profilePicture: true },
      },
      sector: { select: { id: true, name: true, slug: true } },
      project: { select: { id: true, title: true } },
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
              role: true,
            },
          },
        },
      },
      relatedUpdates: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          version: true,
          publishedAt: true,
          createdAt: true,
        },
      },
      _count: { select: { replies: true } },
      ...(currentUser?.id
        ? {
            voteRecords: {
              where: { userId: currentUser.id },
              select: { id: true },
              take: 1,
            },
          }
        : {}),
    },
  });

  if (!data) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature request not found");
  }

  return mapRequest(data);
};

const updateFeatureRequest = async (
  id: string,
  userId: string,
  role: string,
  payload: IUpdateFeatureRequest
) => {
  const existing = await prisma.featureRequest.findUnique({ where: { id } });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature request not found");
  }

  const isAdmin = isAdminRole(role);
  const isOwner = existing.createdById === userId;

  if (!isAdmin && !isOwner) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not allowed to update this request"
    );
  }

  if (!isAdmin) {
    if (existing.status !== FeatureRequestStatus.OPEN) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "You can only edit open requests"
      );
    }
    delete (payload as any).status;
    delete (payload as any).adminNote;
  }

  const data: Prisma.FeatureRequestUpdateInput = { ...payload };

  if (
    payload.status === FeatureRequestStatus.COMPLETED ||
    payload.status === FeatureRequestStatus.REJECTED
  ) {
    data.resolvedAt = new Date();
    data.resolvedBy = { connect: { id: userId } };
  }

  const updated = await prisma.featureRequest.update({
    where: { id },
    data,
    include: {
      createdBy: {
        select: { id: true, name: true, profilePicture: true, role: true },
      },
      resolvedBy: {
        select: { id: true, name: true, profilePicture: true },
      },
      _count: { select: { replies: true } },
    },
  });

  // ── Notify creator when status changes ─────────────────────
  if (
    payload.status &&
    payload.status !== existing.status &&
    existing.createdById !== userId
  ) {
    const statusLabel = payload.status.replace(/_/g, " ").toLowerCase();

    await NotificationService.notifySafe({
      userId: existing.createdById,
      type: NotificationType.SYSTEM,
      title: "Feature Request Status Updated",
      body: `Your request "${existing.title}" is now ${statusLabel}.`,
      entityType: "FeatureRequest",
      entityId: id,
      metadata: {
        previousStatus: existing.status,
        newStatus: payload.status,
        adminNote: payload.adminNote ?? null,
      },
    });
  }

  return { ...updated, votes: updated.votes ?? 0, hasVoted: false };
};

const deleteFeatureRequest = async (
  id: string,
  userId: string,
  role: string
) => {
  // ... keep existing implementation unchanged ...
  const existing = await prisma.featureRequest.findUnique({ where: { id } });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature request not found");
  }

  const isAdmin = isAdminRole(role);
  const isOwner = existing.createdById === userId;

  if (!isAdmin && !isOwner) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not allowed to delete this request"
    );
  }

  await prisma.featureRequest.delete({ where: { id } });

  return { message: "Feature request deleted successfully" };
};

// ═════════════════════════════════════════════════════════════
// Votes
// ═════════════════════════════════════════════════════════════

const toggleVote = async (featureRequestId: string, userId: string) => {
  // ... keep existing implementation unchanged ...
  const request = await prisma.featureRequest.findUnique({
    where: { id: featureRequestId },
    select: { id: true, votes: true },
  });

  if (!request) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature request not found");
  }

  const existing = await prisma.featureRequestVote.findUnique({
    where: {
      featureRequestId_userId: { featureRequestId, userId },
    },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.featureRequestVote.delete({ where: { id: existing.id } }),
      prisma.featureRequest.update({
        where: { id: featureRequestId },
        data: { votes: { decrement: 1 } },
      }),
    ]);
    return { voted: false, votes: Math.max(0, request.votes - 1) };
  }

  await prisma.$transaction([
    prisma.featureRequestVote.create({
      data: { featureRequestId, userId },
    }),
    prisma.featureRequest.update({
      where: { id: featureRequestId },
      data: { votes: { increment: 1 } },
    }),
  ]);

  return { voted: true, votes: request.votes + 1 };
};

// ═════════════════════════════════════════════════════════════
// Replies
// ═════════════════════════════════════════════════════════════

const createReply = async (
  featureRequestId: string,
  userId: string,
  role: string,
  payload: ICreateFeatureRequestReply
) => {
  const request = await prisma.featureRequest.findUnique({
    where: { id: featureRequestId },
    select: {
      id: true,
      title: true,
      createdById: true,
    },
  });

  if (!request) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature request not found");
  }

  const reply = await prisma.featureRequestReply.create({
    data: {
      featureRequestId,
      authorId: userId,
      content: payload.content,
      parentReplyId: payload.parentReplyId,
      isAdminReply: isAdminRole(role),
    },
    include: {
      author: {
        select: { id: true, name: true, profilePicture: true, role: true },
      },
    },
  });

  // ── Collect people who should be notified ──────────────────
  const notifyIds = new Set<string>();

  // Always notify the request creator (unless they are the one replying)
  if (request.createdById !== userId) {
    notifyIds.add(request.createdById);
  }

  // If this is a nested reply, also notify the parent author
  if (payload.parentReplyId) {
    const parent = await prisma.featureRequestReply.findUnique({
      where: { id: payload.parentReplyId },
      select: { authorId: true },
    });
    if (parent && parent.authorId !== userId) {
      notifyIds.add(parent.authorId);
    }
  }

  if (notifyIds.size > 0) {
    await NotificationService.notifyManySafe(
      Array.from(notifyIds),
      {
        type: NotificationType.SYSTEM,
        title: "New Reply on Feature Request",
        body: `${reply.author.name} replied to "${request.title}"`,
        entityType: "FeatureRequest",
        entityId: featureRequestId,
        metadata: {
          replyId: reply.id,
          isAdminReply: reply.isAdminReply,
          parentReplyId: payload.parentReplyId ?? null,
        },
      }
    );
  }

  return reply;
};

const deleteReply = async (replyId: string, userId: string, role: string) => {
  // ... keep existing implementation unchanged ...
  const reply = await prisma.featureRequestReply.findUnique({
    where: { id: replyId },
  });

  if (!reply || reply.deletedAt) {
    throw new ApiError(httpStatus.NOT_FOUND, "Reply not found");
  }

  const isAdmin = isAdminRole(role);
  const isOwner = reply.authorId === userId;

  if (!isAdmin && !isOwner) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "You are not allowed to delete this reply"
    );
  }

  await prisma.featureRequestReply.update({
    where: { id: replyId },
    data: { deletedAt: new Date() },
  });

  return { message: "Reply deleted successfully" };
};

// ═════════════════════════════════════════════════════════════
// Feature Updates
// ═════════════════════════════════════════════════════════════

const createFeatureUpdate = async (
  userId: string,
  role: string,
  payload: ICreateFeatureUpdate
) => {
  if (!isAdminRole(role)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only admins can create feature updates"
    );
  }

  const data = await prisma.featureUpdate.create({
    data: {
      ...payload,
      authorId: userId,
      publishedAt: payload.publishedAt
        ? new Date(payload.publishedAt)
        : new Date(),
    },
    include: {
      author: {
        select: { id: true, name: true, profilePicture: true, role: true },
      },
      relatedFeatureRequest: {
        select: { id: true, title: true, status: true, createdById: true },
      },
      sector: { select: { id: true, name: true, slug: true } },
    },
  });

  // ── Notify the linked feature request creator ──────────────
  if (
    data.relatedFeatureRequest &&
    data.relatedFeatureRequest.createdById !== userId
  ) {
    await NotificationService.notifySafe({
      userId: data.relatedFeatureRequest.createdById,
      type: NotificationType.SYSTEM,
      title: "Update on Your Feature Request",
      body: `A new update "${data.title}" was published for "${data.relatedFeatureRequest.title}"`,
      entityType: "FeatureUpdate",
      entityId: data.id,
      metadata: {
        featureRequestId: data.relatedFeatureRequest.id,
        updateType: data.type,
        version: data.version,
      },
    });
  }

  return data;
};

const getFeatureUpdates = async (
  filters: PaginationQuery & { type?: string; visibility?: string }
) => {
  // ... keep existing implementation unchanged ...
  const pagination = calculatePagination(filters, "publishedAt");
  const { skip, take, sortBy, sortOrder } = pagination;

  const where: Prisma.FeatureUpdateWhereInput = {
    visibility: { in: ["PUBLIC", "MEMBERS_ONLY"] },
  };

  if (filters.type) where.type = filters.type as any;
  if (filters.visibility) where.visibility = filters.visibility as any;

  const [data, total] = await Promise.all([
    prisma.featureUpdate.findMany({
      where,
      skip,
      take,
      orderBy: [{ isPinned: "desc" }, { [sortBy]: sortOrder }],
      include: {
        author: {
          select: { id: true, name: true, profilePicture: true, role: true },
        },
        relatedFeatureRequest: {
          select: { id: true, title: true, status: true },
        },
        sector: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.featureUpdate.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, pagination),
    data,
  };
};

const getFeatureUpdateById = async (id: string) => {
  // ... keep existing implementation unchanged ...
  const data = await prisma.featureUpdate.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, name: true, profilePicture: true, role: true },
      },
      relatedFeatureRequest: {
        select: { id: true, title: true, status: true },
      },
      sector: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!data) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature update not found");
  }

  return data;
};

const updateFeatureUpdate = async (
  id: string,
  userId: string,
  role: string,
  payload: IUpdateFeatureUpdate
) => {
  // ... keep existing implementation unchanged ...
  if (!isAdminRole(role)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only admins can update feature updates"
    );
  }

  const existing = await prisma.featureUpdate.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature update not found");
  }

  const data = await prisma.featureUpdate.update({
    where: { id },
    data: {
      ...payload,
      publishedAt: payload.publishedAt
        ? new Date(payload.publishedAt)
        : undefined,
    },
    include: {
      author: {
        select: { id: true, name: true, profilePicture: true, role: true },
      },
    },
  });

  return data;
};

const deleteFeatureUpdate = async (id: string, role: string) => {
  // ... keep existing implementation unchanged ...
  if (!isAdminRole(role)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only admins can delete feature updates"
    );
  }

  const existing = await prisma.featureUpdate.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature update not found");
  }

  await prisma.featureUpdate.delete({ where: { id } });

  return { message: "Feature update deleted successfully" };
};

export const FeatureService = {
  createFeatureRequest,
  getFeatureRequests,
  getFeatureRequestById,
  updateFeatureRequest,
  deleteFeatureRequest,
  toggleVote,
  createReply,
  deleteReply,
  createFeatureUpdate,
  getFeatureUpdates,
  getFeatureUpdateById,
  updateFeatureUpdate,
  deleteFeatureUpdate,
};