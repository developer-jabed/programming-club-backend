import {
  NotificationType,
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
import { NotificationService } from "../notification/notification.service.js";
import type { ICreateTask, ITaskFilter, IUpdateTask } from "./task.interface.js";

const TaskSearchableFields = ["title", "description"];

// Task has createdAt/dueDate/priority/title. Anything else falls back to createdAt.
const MY_TASK_SORTABLE = ["createdAt", "dueDate", "priority", "title"];

// ⚠ Check your NotificationType enum. If TASK_ASSIGNED doesn't exist, add it
// (then run `npx prisma migrate dev`) or point this at an existing value.
const TASK_ASSIGNED = "TASK_ASSIGNED" as NotificationType;

// ─── Notification helpers ─────────────────────────────────────────

// Removes users who turned off in-app notifications or task-assigned alerts
const filterByPreference = async (userIds: string[]) => {
  if (userIds.length === 0) return [];

  const blocked = await prisma.notificationPreference.findMany({
    where: {
      userId: { in: userIds },
      OR: [{ inAppEnabled: false }, { taskAssigned: false }],
    },
    select: { userId: true },
  });

  const blockedIds = new Set(blocked.map((b) => b.userId));
  return userIds.filter((id) => !blockedIds.has(id));
};

// Sends to many users in small batches. Never throws.
const notifyMany = async (
  userIds: string[],
  input: {
    type: NotificationType;
    title: string;
    body: string;
    entityId: string;
  }
) => {
  try {
    const targets = await filterByPreference(userIds);
    const BATCH = 20;

    for (let i = 0; i < targets.length; i += BATCH) {
      await Promise.all(
        targets.slice(i, i + BATCH).map((userId) =>
          NotificationService.createNotification({
            userId,
            type: input.type,
            title: input.title,
            body: input.body,
            entityType: "Task",
            entityId: input.entityId,
          }).catch((error: unknown) =>
            console.error("[TaskService.notifyMany]", error)
          )
        )
      );
    }
  } catch (error) {
    console.error("[TaskService.notifyMany]", error);
  }
};

// ─── Create ───────────────────────────────────────────────────────

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

    // 4. Assign to all members of a Sector
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

  const result = await prisma.task.findUnique({
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

  // Notify everyone assigned (except the creator)
  if (result) {
    const assigneeIds = result.assignments
      .map((a) => a.userId)
      .filter((id) => id !== userId);

    await notifyMany(assigneeIds, {
      type: TASK_ASSIGNED,
      title: "New task assigned",
      body: `${result.createdBy.name} assigned you a task: ${result.title}`,
      entityId: result.id,
    });
  }

  return result;
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

// ─────────────────────────────────────────────────────────────
// My tasks: tasks assigned to the logged-in user, each carrying
// ONLY that user's own submissions (newest first).
// ─────────────────────────────────────────────────────────────
const getMyTasks = async (
  userId: string,
  filters: ITaskFilter,
  query: PaginationQuery
) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);
  const { searchTerm, status, priority } = filters as any;

  const where: Prisma.TaskWhereInput = {
    assignments: { some: { userId } },
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(searchTerm
      ? {
        OR: TaskSearchableFields.map((field) => ({
          [field]: { contains: searchTerm, mode: "insensitive" },
        })),
      }
      : {}),
  };

  const orderField = MY_TASK_SORTABLE.includes(sortBy) ? sortBy : "createdAt";

  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take,
      orderBy: { [orderField]: sortOrder },
      include: {
        createdBy: { select: { id: true, name: true, profilePicture: true } },
        project: { select: { id: true, title: true } },
        sector: { select: { id: true, name: true } },
        submissions: {
          where: { userId },
          orderBy: { submittedAt: "desc" },
          include: { reviewedBy: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

// ─────────────────────────────────────────────────────────────
// Tasks that belong to a specific project
// ─────────────────────────────────────────────────────────────
const getProjectTasks = async (
  projectId: string,
  filters: ITaskFilter,
  query: PaginationQuery
) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);
  const { searchTerm, status, priority } = filters as any;

  // Ensure the project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, "Project not found");
  }

  const where: Prisma.TaskWhereInput = {
    projectId,
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(searchTerm
      ? {
        OR: TaskSearchableFields.map((field) => ({
          [field]: { contains: searchTerm, mode: "insensitive" },
        })),
      }
      : {}),
  };

  const orderField = MY_TASK_SORTABLE.includes(sortBy) ? sortBy : "createdAt";

  const [data, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take,
      orderBy: { [orderField]: sortOrder },
      include: {
        createdBy: {
          select: { id: true, name: true, profilePicture: true },
        },
        project: {
          select: { id: true, title: true },
        },
        sector: {
          select: { id: true, name: true },
        },
        assignments: {
          include: {
            user: {
              select: { id: true, name: true, profilePicture: true },
            },
          },
        },
        _count: {
          select: { assignments: true, submissions: true },
        },
      },
    }),
    prisma.task.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, {
      page,
      limit,
      skip,
      take,
      sortBy: orderField,
      sortOrder,
    }),
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

  const updated = await prisma.task.update({
    where: { id },
    data: payload,
  });

  // Notify assignees only when something they care about actually changed
  const p = payload as any;
  const changes: string[] = [];

  if (p.status !== undefined && p.status !== task.status) {
    changes.push(`status is now ${String(p.status).toLowerCase().replace(/_/g, " ")}`);
  }
  if (p.priority !== undefined && p.priority !== task.priority) {
    changes.push(`priority is now ${String(p.priority).toLowerCase()}`);
  }
  if (p.dueDate !== undefined) {
    const before = task.dueDate ? task.dueDate.getTime() : null;
    const after = p.dueDate ? new Date(p.dueDate).getTime() : null;
    if (before !== after) changes.push("the due date was changed");
  }

  if (changes.length > 0) {
    const assignments = await prisma.taskAssignment.findMany({
      where: { taskId: id },
      select: { userId: true },
    });

    await notifyMany(
      assignments.map((a) => a.userId).filter((uid) => uid !== userId),
      {
        type: NotificationType.TASK_STATUS_CHANGED,
        title: "Task updated",
        body: `"${updated.title}": ${changes.join(", ")}`,
        entityId: id,
      }
    );
  }

  return updated;
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
  getProjectTasks,
  getMyTasks,
  getSingleTask,
  updateTask,
  deleteTask,
};