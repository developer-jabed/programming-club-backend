import { SubmissionStatus } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import { prisma } from "../../shared/prisma.js";
import type {
  ICreateTaskSubmission,
  IReviewSubmission,
  ICreateProjectSubmission,
} from "./submission.interface.js";
import { NotificationService } from "../notification/notification.service.js";
import { NotificationType } from "@prisma/client";

// ─── Task Submission ──────────────────────────────────────────────

const submitTask = async (
  taskId: string,
  userId: string,
  payload: ICreateTaskSubmission
) => {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new ApiError(httpStatus.NOT_FOUND, "Task not found");

  // Check if user is assigned
  const assignment = await prisma.taskAssignment.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });

  if (!assignment) {
    throw new ApiError(httpStatus.FORBIDDEN, "You are not assigned to this task");
  }

  const existing = await prisma.taskSubmission.findFirst({
    where: { taskId, userId },
  });

  if (existing && existing.status === SubmissionStatus.ACCEPTED) {
    throw new ApiError(httpStatus.BAD_REQUEST, "This task is already accepted");
  }

  const submission = await prisma.taskSubmission.create({
    data: {
      taskId,
      userId,
      content: payload.content,
      link: payload.link,
      fileUrls: payload.fileUrls || [],
      status: SubmissionStatus.SUBMITTED,
    },
    include: {
      user: { select: { id: true, name: true, profilePicture: true } },
      task: { select: { id: true, title: true } },
    },
  });

  // Update assignment status
  await prisma.taskAssignment.update({
    where: { taskId_userId: { taskId, userId } },
    data: { status: "IN_REVIEW" },
  });

  // Notify task creator
  await NotificationService.createNotification({
    userId: task.createdById,
    type: NotificationType.TASK_STATUS_CHANGED,
    title: "New Task Submission",
    body: `${submission.user.name} submitted the task: ${task.title}`,
    entityType: "TaskSubmission",
    entityId: submission.id,
  });

  return submission;
};

const reviewTaskSubmission = async (
  submissionId: string,
  reviewerId: string,
  payload: IReviewSubmission
) => {
  const submission = await prisma.taskSubmission.findUnique({
    where: { id: submissionId },
    include: { task: true },
  });

  if (!submission) {
    throw new ApiError(httpStatus.NOT_FOUND, "Submission not found");
  }

  const updated = await prisma.taskSubmission.update({
    where: { id: submissionId },
    data: {
      status: payload.status as SubmissionStatus,
      score: payload.score,
      feedback: payload.feedback,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
    include: {
      user: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  // Update assignment
  await prisma.taskAssignment.update({
    where: {
      taskId_userId: {
        taskId: submission.taskId,
        userId: submission.userId,
      },
    },
    data: {
      status: payload.status === "ACCEPTED" ? "COMPLETED" : "IN_PROGRESS",
      score: payload.score,
      feedback: payload.feedback,
      completedAt: payload.status === "ACCEPTED" ? new Date() : null,
    },
  });

  // Notify student
  await NotificationService.createNotification({
    userId: submission.userId,
    type: NotificationType.SUBMISSION_REVIEWED,
    title: "Submission Reviewed",
    body: `Your submission for "${submission.task.title}" was ${payload.status.toLowerCase()}`,
    entityType: "TaskSubmission",
    entityId: submission.id,
  });

  return updated;
};

const getTaskSubmissions = async (taskId: string) => {
  return prisma.taskSubmission.findMany({
    where: { taskId },
    include: {
      user: { select: { id: true, name: true, profilePicture: true, group: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { submittedAt: "desc" },
  });
};

// ─── Project Submission ───────────────────────────────────────────

const submitProject = async (
  projectId: string,
  userId: string,
  payload: ICreateProjectSubmission
) => {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, "Project not found");

  // Only owner or active members can submit
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new ApiError(httpStatus.FORBIDDEN, "You are not a member of this project");
  }

  const submission = await prisma.projectSubmission.create({
    data: {
      projectId,
      submittedById: userId,
      title: payload.title,
      description: payload.description,
      link: payload.link,
      extraLinks: payload.extraLinks || [],
      status: SubmissionStatus.SUBMITTED,
    },
    include: {
      submittedBy: { select: { id: true, name: true, profilePicture: true } },
      project: { select: { id: true, title: true } },
    },
  });

  // Notify project owner
  if (project.ownerId !== userId) {
    await NotificationService.createNotification({
      userId: project.ownerId,
      type: NotificationType.SUBMISSION_REVIEWED,
      title: "New Project Submission",
      body: `${submission.submittedBy.name} submitted the project: ${project.title}`,
      entityType: "ProjectSubmission",
      entityId: submission.id,
    });
  }

  return submission;
};

const reviewProjectSubmission = async (
  submissionId: string,
  reviewerId: string,
  payload: IReviewSubmission
) => {
  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { project: true },
  });

  if (!submission) {
    throw new ApiError(httpStatus.NOT_FOUND, "Submission not found");
  }

  if (submission.project.ownerId !== reviewerId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only project owner can review");
  }

  const updated = await prisma.projectSubmission.update({
    where: { id: submissionId },
    data: {
      status: payload.status as SubmissionStatus,
      score: payload.score,
      feedback: payload.feedback,
      reviewedAt: new Date(),
      reviewedById: reviewerId,
    },
  });

  // Notify submitter
  await NotificationService.createNotification({
    userId: submission.submittedById,
    type: NotificationType.SUBMISSION_REVIEWED,
    title: "Project Submission Reviewed",
    body: `Your project submission was ${payload.status.toLowerCase()}`,
    entityType: "ProjectSubmission",
    entityId: submission.id,
  });

  return updated;
};

export const SubmissionService = {
  submitTask,
  reviewTaskSubmission,
  getTaskSubmissions,
  submitProject,
  reviewProjectSubmission,
};