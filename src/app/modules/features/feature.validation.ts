import { FeatureRequestPriority, FeatureRequestStatus, FeatureUpdateType, FeatureUpdateVisibility } from "@prisma/client";
import { z } from "zod";


const createFeatureRequest = z.object({
  body: z.object({
    title: z.string().min(3).max(200),
    description: z.string().min(10),
    priority: z.nativeEnum(FeatureRequestPriority).optional(),
    sectorId: z.string().cuid().optional(),
    projectId: z.string().cuid().optional(),
  }),
});

const updateFeatureRequest = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().min(10).optional(),
    priority: z.nativeEnum(FeatureRequestPriority).optional(),
    status: z.nativeEnum(FeatureRequestStatus).optional(),
    adminNote: z.string().max(1000).optional(),
  }),
});

const createReply = z.object({
  body: z.object({
    content: z.string().min(1).max(5000),
    parentReplyId: z.string().cuid().optional(),
  }),
});

const createFeatureUpdate = z.object({
  body: z.object({
    title: z.string().min(3).max(200),
    content: z.string().min(10),
    type: z.nativeEnum(FeatureUpdateType).optional(),
    visibility: z.nativeEnum(FeatureUpdateVisibility).optional(),
    isPinned: z.boolean().optional(),
    version: z.string().max(50).optional(),
    tags: z.array(z.string()).optional(),
    relatedFeatureRequestId: z.string().cuid().optional(),
    sectorId: z.string().cuid().optional(),
    publishedAt: z.string().datetime().optional().or(z.date().optional()),
  }),
});

const updateFeatureUpdate = z.object({
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    content: z.string().min(10).optional(),
    type: z.nativeEnum(FeatureUpdateType).optional(),
    visibility: z.nativeEnum(FeatureUpdateVisibility).optional(),
    isPinned: z.boolean().optional(),
    version: z.string().max(50).optional(),
    tags: z.array(z.string()).optional(),
    relatedFeatureRequestId: z.string().cuid().nullable().optional(),
    sectorId: z.string().cuid().nullable().optional(),
    publishedAt: z.string().datetime().nullable().optional().or(z.date().nullable().optional()),
  }),
});

export const FeatureValidation = {
  createFeatureRequest,
  updateFeatureRequest,
  createReply,
  createFeatureUpdate,
  updateFeatureUpdate,
};