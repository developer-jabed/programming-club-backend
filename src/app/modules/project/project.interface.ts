import { ProjectStatus, ProjectMemberRole, ProjectMemberStatus } from "@prisma/client";

export type IProjectFilter = {
  searchTerm?: string;
  status?: ProjectStatus;
  isPublic?: boolean;
  ownerId?: string;
};

export type ICreateProject = {
  title: string;
  description?: string;
  isPublic?: boolean;
  maxMembers?: number;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  sectorId?: string;
};

export type IUpdateProject = Partial<ICreateProject> & {
  status?: ProjectStatus;
};

export type IContributionRequest = {
  projectId: string;
};