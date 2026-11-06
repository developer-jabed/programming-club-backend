import { Prisma, UserRole, FeatureRequestStatus } from "@prisma/client";
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

// JwtPayload.role এখন string, তাই এখানেও string ধরা হয়েছে
const isAdminRole = (role: string) =>
  role === UserRole.ADMIN || role === UserRole.MODERATOR;

const createFeatureRequest = async (userId: string, payload: ICreateFeatureRequest) => {
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
    },
  });

  return data;
};

const getFeatureRequests = async (
  filters: IFeatureRequestQuery & PaginationQuery,
  currentUser?: { id: string; role: string }
) => {
  const pagination = calculatePagination(filters, "createdAt");
  const { skip, take, sortBy, sortOrder } = pagination;

  const andConditions: Prisma.FeatureRequestWhereInput[] = [];

  if (filters.status) andConditions.push({ status: filters.status });
  if (filters.priority) andConditions.push({ priority: filters.priority });
  if (filters.sectorId) andConditions.push({ sectorId: filters.sectorId });
  if (filters.projectId) andConditions.push({ projectId: filters.projectId });
  if (filters.createdById) andConditions.push({ createdById: filters.createdById });

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

  const [data, total] = await Promise.all([
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
      },
    }),
    prisma.featureRequest.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, pagination), // ← fix: ২টা argument
    data,
  };
};

const getFeatureRequestById = async (id: string) => {
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
            select: { id: true, name: true, profilePicture: true, role: true },
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
    },
  });

  if (!data) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature request not found");
  }

  return data;
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

  // Only owner can edit title/description (if still OPEN)
  // Only admin/moderator can change status / adminNote
  if (!isAdmin && !isOwner) {
    throw new ApiError(httpStatus.FORBIDDEN, "You are not allowed to update this request");
  }

  if (!isAdmin) {
    // Member can only update title & description while status is OPEN
    if (existing.status !== FeatureRequestStatus.OPEN) {
      throw new ApiError(httpStatus.FORBIDDEN, "You can only edit open requests");
    }

    // Strip admin-only fields
    delete (payload as any).status;
    delete (payload as any).adminNote;
  }

  const data: Prisma.FeatureRequestUpdateInput = { ...payload };

  // Auto set resolved info
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
    },
  });

  return updated;
};

const deleteFeatureRequest = async (id: string, userId: string, role: string) => {
  const existing = await prisma.featureRequest.findUnique({ where: { id } });

  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature request not found");
  }

  const isAdmin = isAdminRole(role);
  const isOwner = existing.createdById === userId;

  if (!isAdmin && !isOwner) {
    throw new ApiError(httpStatus.FORBIDDEN, "You are not allowed to delete this request");
  }

  // Hard delete
  await prisma.featureRequest.delete({ where: { id } });

  return { message: "Feature request deleted successfully" };
};

const createReply = async (
  featureRequestId: string,
  userId: string,
  role: string,
  payload: ICreateFeatureRequestReply
) => {
  const request = await prisma.featureRequest.findUnique({
    where: { id: featureRequestId },
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

  return reply;
};

const deleteReply = async (replyId: string, userId: string, role: string) => {
  const reply = await prisma.featureRequestReply.findUnique({
    where: { id: replyId },
  });

  if (!reply || reply.deletedAt) {
    throw new ApiError(httpStatus.NOT_FOUND, "Reply not found");
  }

  const isAdmin = isAdminRole(role);
  const isOwner = reply.authorId === userId;

  if (!isAdmin && !isOwner) {
    throw new ApiError(httpStatus.FORBIDDEN, "You are not allowed to delete this reply");
  }

  // Soft delete
  await prisma.featureRequestReply.update({
    where: { id: replyId },
    data: { deletedAt: new Date() },
  });

  return { message: "Reply deleted successfully" };
};

// ==================== Feature Updates ====================

const createFeatureUpdate = async (
  userId: string,
  role: string,
  payload: ICreateFeatureUpdate
) => {
  if (!isAdminRole(role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only admins can create feature updates");
  }

  const data = await prisma.featureUpdate.create({
    data: {
      ...payload,
      authorId: userId,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : new Date(),
    },
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

  return data;
};

const getFeatureUpdates = async (
  filters: PaginationQuery & { type?: string; visibility?: string }
) => {
  // default sort publishedAt, কারণ নিচে আগে isPinned দিয়ে sort হচ্ছে
  const pagination = calculatePagination(filters, "publishedAt");
  const { skip, take, sortBy, sortOrder } = pagination;

  const where: Prisma.FeatureUpdateWhereInput = {
    // By default show only public + members_only (adjust as needed)
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
    meta: buildPaginationMeta(total, pagination), // ← fix: ২টা argument
    data,
  };
};

const getFeatureUpdateById = async (id: string) => {
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
  if (!isAdminRole(role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only admins can update feature updates");
  }

  const existing = await prisma.featureUpdate.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Feature update not found");
  }

  const data = await prisma.featureUpdate.update({
    where: { id },
    data: {
      ...payload,
      publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : undefined,
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
  if (!isAdminRole(role)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only admins can delete feature updates");
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
  createReply,
  deleteReply,
  createFeatureUpdate,
  getFeatureUpdates,
  getFeatureUpdateById,
  updateFeatureUpdate,
  deleteFeatureUpdate,
};