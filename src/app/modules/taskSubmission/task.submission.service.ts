import { Prisma, SubmissionStatus, UserRole } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";
import { prisma } from "../../shared/prisma.js";
import type {
  ISubmitTask,
  IUpdateSubmission,
  IReviewSubmission,
  ISubmissionFilter,
} from "./task.submission.interface.js";

type Actor = { id: string; role: UserRole };

// TaskSubmission has no createdAt, so sorting by it would crash Prisma.
const SORTABLE = ["submittedAt", "reviewedAt", "score", "status"];

// After one of these review statuses the member may submit again.
// Names that don't exist in your enum are simply never matched.
const RESUBMITTABLE: string[] = [
  "REJECTED",
  "REVISION_REQUESTED",
  "NEEDS_REVISION",
  "RESUBMIT",
];

const DEFAULT_MAX_SCORE = 100;

const include = {
  user: {
    select: { id: true, name: true, email: true, profilePicture: true, group: true },
  },
  reviewedBy: { select: { id: true, name: true } },
  task: { select: { id: true, title: true, createdById: true } },
} satisfies Prisma.TaskSubmissionInclude;

const getTaskOrThrow = async (taskId: string) => {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Task not found");
  return task;
};

const canManageTask = (task: { createdById: string }, actor: Actor) =>
  actor.role === UserRole.ADMIN || task.createdById === actor.id;

const getSubmissionOrThrow = async (id: string) => {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id },
    include,
  });
  if (!submission) throw new ApiError(httpStatus.NOT_FOUND, "Submission not found");
  return submission;
};

const resolveSort = (sortBy: string) =>
  SORTABLE.includes(sortBy) ? sortBy : "submittedAt";

// ─────────────────────────────────────────────────────────────
// Submit
// ─────────────────────────────────────────────────────────────
const submitTask = async (taskId: string, userId: string, payload: ISubmitTask) => {
  await getTaskOrThrow(taskId);

  const assignment = await prisma.taskAssignment.findFirst({
    where: { taskId, userId },
  });
  if (!assignment) {
    throw new ApiError(httpStatus.FORBIDDEN, "This task is not assigned to you");
  }

  const latest = await prisma.taskSubmission.findFirst({
    where: { taskId, userId },
    orderBy: { submittedAt: "desc" },
  });

  if (latest && !RESUBMITTABLE.includes(latest.status as string)) {
    throw new ApiError(
      httpStatus.CONFLICT,
      latest.status === SubmissionStatus.SUBMITTED
        ? "You have already submitted this task. Edit your submission instead."
        : "Your submission has already been reviewed"
    );
  }

  return prisma.taskSubmission.create({
    data: {
      taskId,
      userId,
      content: payload.content || null,
      link: payload.link || null,
      fileUrls: payload.fileUrls ?? [],
    },
    include,
  });
};

// ─────────────────────────────────────────────────────────────
// Edit / delete (owner, before review)
// ─────────────────────────────────────────────────────────────
const updateSubmission = async (
  id: string,
  userId: string,
  payload: IUpdateSubmission
) => {
  const submission = await getSubmissionOrThrow(id);

  if (submission.userId !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "You can only edit your own submission");
  }
  if (submission.status !== SubmissionStatus.SUBMITTED) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "A reviewed submission can no longer be edited"
    );
  }

  const content = payload.content !== undefined ? payload.content : submission.content;
  const link = payload.link !== undefined ? payload.link : submission.link;
  const fileUrls = payload.fileUrls !== undefined ? payload.fileUrls : submission.fileUrls;

  if (!content && !link && fileUrls.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "A submission needs content, a link, or at least one file"
    );
  }

  return prisma.taskSubmission.update({
    where: { id },
    data: { content: content || null, link: link || null, fileUrls },
    include,
  });
};

const deleteSubmission = async (id: string, actor: Actor) => {
  const submission = await getSubmissionOrThrow(id);
  const isAdmin = actor.role === UserRole.ADMIN;

  if (!isAdmin) {
    if (submission.userId !== actor.id) {
      throw new ApiError(httpStatus.FORBIDDEN, "You can only delete your own submission");
    }
    if (submission.status !== SubmissionStatus.SUBMITTED) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "A reviewed submission can no longer be deleted"
      );
    }
  }

  return prisma.taskSubmission.delete({ where: { id } });
};

// ─────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────
const getSingleSubmission = async (id: string, actor: Actor) => {
  const submission = await getSubmissionOrThrow(id);

  if (submission.userId !== actor.id && !canManageTask(submission.task, actor)) {
    throw new ApiError(httpStatus.FORBIDDEN, "You cannot view this submission");
  }
  return submission;
};

const getMySubmissions = async (
  userId: string,
  filters: ISubmissionFilter,
  query: PaginationQuery
) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);

  const where: Prisma.TaskSubmissionWhereInput = {
    userId,
    ...(filters.taskId && { taskId: filters.taskId }),
    ...(filters.status && { status: filters.status }),
  };

  const [data, total] = await Promise.all([
    prisma.taskSubmission.findMany({
      where,
      skip,
      take,
      orderBy: { [resolveSort(sortBy)]: sortOrder },
      include,
    }),
    prisma.taskSubmission.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

const getTaskSubmissions = async (
  taskId: string,
  actor: Actor,
  filters: ISubmissionFilter,
  query: PaginationQuery
) => {
  const task = await getTaskOrThrow(taskId);
  if (!canManageTask(task, actor)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the task creator can view all submissions"
    );
  }

  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);

  const where: Prisma.TaskSubmissionWhereInput = {
    taskId,
    ...(filters.status && { status: filters.status }),
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.searchTerm && {
      user: { name: { contains: filters.searchTerm, mode: "insensitive" } },
    }),
  };

  const [data, total] = await Promise.all([
    prisma.taskSubmission.findMany({
      where,
      skip,
      take,
      orderBy: { [resolveSort(sortBy)]: sortOrder },
      include,
    }),
    prisma.taskSubmission.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

const getSubmissionSummary = async (taskId: string, actor: Actor) => {
  const task = await getTaskOrThrow(taskId);
  if (!canManageTask(task, actor)) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the task creator can view the summary");
  }

  const [assigned, byStatus, submitters, scores] = await Promise.all([
    prisma.taskAssignment.count({ where: { taskId } }),
    prisma.taskSubmission.groupBy({
      by: ["status"],
      where: { taskId },
      _count: { _all: true },
    }),
    prisma.taskSubmission.groupBy({ by: ["userId"], where: { taskId } }),
    prisma.taskSubmission.aggregate({
      where: { taskId, score: { not: null } },
      _avg: { score: true },
      _max: { score: true },
      _min: { score: true },
      _count: { score: true },
    }),
  ]);

  const submittedUsers = submitters.length;

  return {
    taskId,
    assigned,
    submittedUsers,
    notSubmitted: Math.max(assigned - submittedUsers, 0),
    // Rows per status (a resubmission adds a row)
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
    marked: scores._count.score,
    averageScore: scores._avg.score,
    highestScore: scores._max.score,
    lowestScore: scores._min.score,
  };
};

// ─────────────────────────────────────────────────────────────
// Marking
// ─────────────────────────────────────────────────────────────
const reviewSubmission = async (
  id: string,
  actor: Actor,
  payload: IReviewSubmission
) => {
  const submission = await getSubmissionOrThrow(id);

  if (!canManageTask(submission.task, actor)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Only the task creator can review submissions"
    );
  }
  if (submission.userId === actor.id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot review your own submission");
  }

  // Uses the task's own limit if it has one, otherwise 100
  const taskAny = (await prisma.task.findUnique({
    where: { id: submission.taskId },
  })) as any;
  const maxScore: number = taskAny?.maxScore ?? taskAny?.points ?? DEFAULT_MAX_SCORE;

  if (payload.score !== undefined && payload.score > maxScore) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Score cannot be more than ${maxScore}`);
  }

  return prisma.taskSubmission.update({
    where: { id },
    data: {
      status: payload.status,
      score: payload.score ?? null,
      feedback: payload.feedback || null,
      reviewedAt: new Date(),
      reviewedById: actor.id,
    },
    include,
  });
};

export const TaskSubmissionService = {
  submitTask,
  updateSubmission,
  deleteSubmission,
  getSingleSubmission,
  getMySubmissions,
  getTaskSubmissions,
  getSubmissionSummary,
  reviewSubmission,
};