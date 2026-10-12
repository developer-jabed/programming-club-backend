import { Prisma, ProjectStatus, ProjectMemberRole, ProjectMemberStatus } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import { calculatePagination, buildPaginationMeta, type PaginationQuery } from "../../helper/paginationHelper.js";
import { prisma } from "../../shared/prisma.js";
import type { ICreateProject, IProjectFilter, IUpdateProject } from "./project.interface.js";

const ProjectSearchableFields = ["title", "description"];

const createProject = async (userId: string, payload: ICreateProject) => {
  const project = await prisma.project.create({
    data: {
      ...payload,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: ProjectMemberRole.OWNER,
          status: ProjectMemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      },
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true, profilePicture: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, profilePicture: true },
          },
        },
      },
    },
  });

  return project;
};

const getAllProjects = async (filters: IProjectFilter, query: PaginationQuery) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.ProjectWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: ProjectSearchableFields.map((field) => ({
        [field]: { contains: searchTerm, mode: "insensitive" },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([key, value]) => ({
        [key]: { equals: value },
      })),
    });
  }

  const where: Prisma.ProjectWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        owner: { select: { id: true, name: true, profilePicture: true } },
        _count: { select: { members: true, tasks: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

const getSingleProject = async (id: string) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true, profilePicture: true } },
      members: {
        where: { status: ProjectMemberStatus.ACTIVE },
        include: {
          user: { select: { id: true, name: true, profilePicture: true, role: true } },
        },
      },
      tasks: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { members: true, tasks: true, chatMessages: true } },
    },
  });

  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  return project;
};

const updateProject = async (id: string, userId: string, payload: IUpdateProject) => {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  if (project.ownerId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only owner can update this project");
  }

  return prisma.project.update({
    where: { id },
    data: payload,
  });
};

const deleteProject = async (id: string, userId: string) => {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  if (project.ownerId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only owner can delete this project");
  }

  return prisma.project.delete({ where: { id } });
};

// Contribution Request
const requestToJoin = async (projectId: string, userId: string) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Project not found");

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "You already requested or are a member");
  }

  return prisma.projectMember.create({
    data: {
      projectId,
      userId,
      role: ProjectMemberRole.MEMBER,
      status: ProjectMemberStatus.PENDING,
    },
  });
};

const handleContributionRequest = async (
  projectId: string,
  memberId: string,
  ownerId: string,
  status: "ACTIVE" | "REJECTED"
) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== ownerId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only owner can manage requests");
  }

  return prisma.projectMember.update({
    where: { id: memberId },
    data: {
      status: status as ProjectMemberStatus,
      joinedAt: status === "ACTIVE" ? new Date() : null,
    },
  });
};

export const ProjectService = {
  createProject,
  getAllProjects,
  getSingleProject,
  updateProject,
  deleteProject,
  requestToJoin,
  handleContributionRequest,
};