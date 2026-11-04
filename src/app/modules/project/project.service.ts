import { Prisma, ProjectMemberRole, ProjectMemberStatus } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import { calculatePagination, buildPaginationMeta, type PaginationQuery } from "../../helper/paginationHelper.js";
import { prisma } from "../../shared/prisma.js";
import type { ICreateProject, IProjectFilter, IUpdateProject } from "./project.interface.js";

const ProjectSearchableFields = ["title", "description"];

// Shared where-builder for list endpoints
const buildProjectWhere = (
  filters: IProjectFilter,
  extra: Prisma.ProjectWhereInput = {}
): Prisma.ProjectWhereInput => {
  const { searchTerm, ...filterData } = filters;
  const andConditions: Prisma.ProjectWhereInput[] = [extra];

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

  return { AND: andConditions };
};

const createProject = async (userId: string, payload: ICreateProject) => {
  const project = await prisma.project.create({
    data: {
      ...payload,
      ownerId: userId,
      sectorId: payload.sectorId,
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

// All projects. When userId is present, the viewer's own membership row is
// attached as `members` so the UI can show Join / Pending / Member state.
const getAllProjects = async (
  filters: IProjectFilter,
  query: PaginationQuery,
  userId?: string
) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);
  const where = buildProjectWhere(filters);

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        owner: { select: { id: true, name: true, profilePicture: true } },
        sector: { select: { id: true, name: true } },
        _count: {
          select: {
            members: { where: { status: ProjectMemberStatus.ACTIVE } },
            tasks: true,
          },
        },
        ...(userId && {
          members: {
            where: { userId },
            select: { id: true, userId: true, status: true, role: true },
          },
        }),
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

// Only the projects owned by the logged-in user
const getMyProjects = async (
  userId: string,
  filters: IProjectFilter,
  query: PaginationQuery
) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);

  // ownerId is forced to the current user; a client-supplied ownerId is ignored
  const { ownerId: _ignored, ...safeFilters } = filters as any;
  const where = buildProjectWhere(safeFilters, { ownerId: userId });

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        owner: { select: { id: true, name: true, profilePicture: true } },
        sector: { select: { id: true, name: true } },
        _count: {
          select: {
            members: { where: { status: ProjectMemberStatus.ACTIVE } },
            tasks: true,
          },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

// ACTIVE members for everyone.
// + PENDING requests (with email) only when the viewer is the owner.
// + the viewer's own non-active row so the UI can show its state.
const getSingleProject = async (id: string, userId?: string) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, profilePicture: true } },
      sector: { select: { id: true, name: true } },
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
      _count: {
        select: {
          members: { where: { status: ProjectMemberStatus.ACTIVE } },
          tasks: true,
          chatMessages: true,
        },
      },
    },
  });

  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Project not found");

  const isOwner = !!userId && project.ownerId === userId;

  const [pendingMembers, myMembership] = await Promise.all([
    isOwner
      ? prisma.projectMember.findMany({
          where: { projectId: id, status: ProjectMemberStatus.PENDING },
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, name: true, email: true, profilePicture: true } },
          },
        })
      : Promise.resolve([]),
    userId && !isOwner
      ? prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: id, userId } },
        })
      : Promise.resolve(null),
  ]);

  const extra = [
    ...pendingMembers,
    ...(myMembership && myMembership.status !== ProjectMemberStatus.ACTIVE ? [myMembership] : []),
  ];

  return { ...project, members: [...project.members, ...extra] };
};

const updateProject = async (id: string, userId: string, payload: IUpdateProject) => {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  if (project.ownerId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the owner can update this project");
  }

  return prisma.project.update({
    where: { id },
    data: payload,
  });
};

// Projects where the user is an ACTIVE member (includes owned projects)
const getJoinedProjects = async (
  userId: string,
  filters: IProjectFilter,
  query: PaginationQuery
) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);

  // Ignore client-supplied ownerId
  const { ownerId: _ignored, ...safeFilters } = filters as any;

  const where = buildProjectWhere(safeFilters, {
    members: {
      some: {
        userId,
        status: ProjectMemberStatus.ACTIVE,
      },
    },
  });

  const [data, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        owner: { select: { id: true, name: true, profilePicture: true } },
        sector: { select: { id: true, name: true } },
        _count: {
          select: {
            members: { where: { status: ProjectMemberStatus.ACTIVE } },
            tasks: true,
          },
        },
        // Attach the current user's membership row
        members: {
          where: { userId },
          select: {
            id: true,
            userId: true,
            status: true,
            role: true,
            joinedAt: true,
          },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

const deleteProject = async (id: string, userId: string) => {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  if (project.ownerId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the owner can delete this project");
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
    // A member who left may ask again
    if (existing.status === ProjectMemberStatus.LEFT) {
      return prisma.projectMember.update({
        where: { id: existing.id },
        data: { status: ProjectMemberStatus.PENDING, joinedAt: null },
      });
    }
    throw new ApiError(
      httpStatus.CONFLICT,
      "You have already requested to join or are a member of this project"
    );
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
  status: "ACTIVE" | "REJECTED" | "LEFT"
) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== ownerId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the owner can manage requests");
  }

  // The member row must belong to THIS project
  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
  });
  if (!member) throw new ApiError(httpStatus.NOT_FOUND, "Member not found");

  if (member.userId === project.ownerId) {
    throw new ApiError(httpStatus.BAD_REQUEST, "The project owner cannot be removed");
  }

  if (status === "ACTIVE" && project.maxMembers) {
    const activeCount = await prisma.projectMember.count({
      where: { projectId, status: ProjectMemberStatus.ACTIVE },
    });
    if (activeCount >= project.maxMembers) {
      throw new ApiError(httpStatus.BAD_REQUEST, "The project has reached its maximum number of members");
    }
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
  getMyProjects,
  getSingleProject,
  updateProject,
  deleteProject,
  getJoinedProjects,
  requestToJoin,
  handleContributionRequest,
};