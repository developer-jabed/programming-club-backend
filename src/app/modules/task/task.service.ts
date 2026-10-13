import {
  Prisma,
  TaskStatus,
  TaskPriority,
  TaskTargetType,
} from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";
import { prisma } from "../../shared/prisma.js";
import type { ICreateTask, ITaskFilter, IUpdateTask } from "./task.interface.js";

const TaskSearchableFields = ["title", "description"];

const createTask = async (userId: string, payload: ICreateTask) => {
  const { memberIds = [], groups = [], sectorId, ...taskData } = payload;

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await tx.task.create({
      data: {
        ...taskData,
        createdById: userId,
        sectorId: sectorId || null,
        status: TaskStatus.TODO,
      },
    });

    // 1. Assign to specific members
    if (payload.targetType === TaskTargetType.SPECIFIC_MEMBERS && memberIds.length > 0) {
      await tx.taskAssignment.createMany({
        data: memberIds.map((id) => ({
          taskId: createdTask.id,
          userId: id,
        })),
        skipDuplicates: true,
      });
    }

    // 2. Assign to groups
    if (payload.targetType === TaskTargetType.SPECIFIC_GROUPS && groups.length > 0) {
      await tx.taskTargetGroup.createMany({
        data: groups.map((group) => ({
          taskId: createdTask.id,
          groupName: group,
        })),
        skipDuplicates: true,
      });

      const membersInGroups = await tx.user.findMany({
        where: {
          group: { in: groups },
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (membersInGroups.length > 0) {
        await tx.taskAssignment.createMany({
          data: membersInGroups.map((m) => ({
            taskId: createdTask.id,
            userId: m.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 3. Assign to all members of the club
    if (payload.targetType === TaskTargetType.ALL_MEMBERS) {
      const allMembers = await tx.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });

      if (allMembers.length > 0) {
        await tx.taskAssignment.createMany({
          data: allMembers.map((m) => ({
            taskId: createdTask.id,
            userId: m.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 4. Assign to all members of a Sector (NEW)
    if (payload.targetType === TaskTargetType.SECTOR_MEMBERS && sectorId) {
      const sectorMembers = await tx.sectorMember.findMany({
        where: { sectorId },
        select: { userId: true },
      });

      if (sectorMembers.length > 0) {
        await tx.taskAssignment.createMany({
          data: sectorMembers.map((m) => ({
            taskId: createdTask.id,
            userId: m.userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 5. Assign to project members (if projectId exists)
    if (payload.targetType === TaskTargetType.PROJECT_MEMBERS && payload.projectId) {
      const projectMembers = await tx.projectMember.findMany({
        where: {
          projectId: payload.projectId,
          status: "ACTIVE",
        },
        select: { userId: true },
      });

      if (projectMembers.length > 0) {
        await tx.taskAssignment.createMany({
          data: projectMembers.map((m) => ({
            taskId: createdTask.id,
            userId: m.userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return createdTask;
  });

  return prisma.task.findUnique({
    where: { id: task.id },
    include: {
      createdBy: {
        select: { id: true, name: true, profilePicture: true },
      },
      project: {
        select: { id: true, title: true },
      },
      sector: {
        select: { id: true, name: true, slug: true },
      },
      assignments: {
        include: {
          user: {
            select: { id: true, name: true, profilePicture: true },
          },
        },
      },
      targetGroups: true,
    },
  });
};
const getAllTasks = async (filters: ITaskFilter, query: PaginationQuery) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.TaskWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: TaskSearchableFields.map((field) => ({
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

  const where: Prisma.TaskWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        createdBy: { select: { id: true, name: true, profilePicture: true } },
        project: { select: { id: true, title: true } },
        sector: { select: { id: true, name: true, slug: true } },
        _count: { select: { assignments: true, submissions: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

const getSingleTask = async (id: string) => {
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, profilePicture: true } },
      project: { select: { id: true, title: true } },
      assignments: {
        include: {
          user: { select: { id: true, name: true, profilePicture: true, group: true } },
        },
      },
      targetGroups: true,
      submissions: {
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Task not found");
  return task;
};

const updateTask = async (id: string, userId: string, payload: IUpdateTask) => {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Task not found");
  if (task.createdById !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only creator can update this task");
  }

  return prisma.task.update({
    where: { id },
    data: payload,
  });
};

const deleteTask = async (id: string, userId: string) => {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Task not found");
  if (task.createdById !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only creator can delete this task");
  }

  return prisma.task.delete({ where: { id } });
};

export const TaskService = {
  createTask,
  getAllTasks,
  getSingleTask,
  updateTask,
  deleteTask,
};