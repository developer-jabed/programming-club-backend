import type { FeatureRequestStatus, FeatureRequestPriority, FeatureUpdateType, FeatureUpdateVisibility } from "@prisma/client";

export interface ICreateFeatureRequest {
  title: string;
  description: string;
  priority?: FeatureRequestPriority;
  sectorId?: string;
  projectId?: string;
}

export interface IUpdateFeatureRequest {
  title?: string;
  description?: string;
  priority?: FeatureRequestPriority;
  status?: FeatureRequestStatus;
  adminNote?: string;
}

export interface ICreateFeatureRequestReply {
  content: string;
  parentReplyId?: string;
}

export interface ICreateFeatureUpdate {
  title: string;
  content: string;
  type?: FeatureUpdateType;
  visibility?: FeatureUpdateVisibility;
  isPinned?: boolean;
  version?: string;
  tags?: string[];
  relatedFeatureRequestId?: string;
  sectorId?: string;
  publishedAt?: string | Date;
}

export interface IUpdateFeatureUpdate {
  title?: string;
  content?: string;
  type?: FeatureUpdateType;
  visibility?: FeatureUpdateVisibility;
  isPinned?: boolean;
  version?: string;
  tags?: string[];
  relatedFeatureRequestId?: string | null;
  sectorId?: string | null;
  publishedAt?: string | Date | null;
}

export interface IFeatureRequestQuery {
  status?: FeatureRequestStatus;
  priority?: FeatureRequestPriority;
  sectorId?: string;
  projectId?: string;
  createdById?: string;
  search?: string;
}