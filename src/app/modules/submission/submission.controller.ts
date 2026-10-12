import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { SubmissionService } from "./submission.service.js";
import sendResponse from "../../shared/sendResponse.js";
import type { JwtPayload } from "../auth/auth.interface.js";

const submitTask = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { taskId } = req.params as { taskId: string };

  const result = await SubmissionService.submitTask(taskId, user.id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Task submitted successfully",
    data: result,
  });
};

const reviewTaskSubmission = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { submissionId } = req.params as { submissionId: string };

  const result = await SubmissionService.reviewTaskSubmission(
    submissionId,
    user.id,
    req.body as any
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submission reviewed successfully",
    data: result,
  });
};

const getTaskSubmissions = async (req: FastifyRequest, reply: FastifyReply) => {
  const { taskId } = req.params as { taskId: string };
  const result = await SubmissionService.getTaskSubmissions(taskId);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submissions retrieved successfully",
    data: result,
  });
};

const submitProject = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { projectId } = req.params as { projectId: string };

  const result = await SubmissionService.submitProject(
    projectId,
    user.id,
    req.body as any
  );

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Project submitted successfully",
    data: result,
  });
};

const reviewProjectSubmission = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { submissionId } = req.params as { submissionId: string };

  const result = await SubmissionService.reviewProjectSubmission(
    submissionId,
    user.id,
    req.body as any
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project submission reviewed successfully",
    data: result,
  });
};

export const SubmissionController = {
  submitTask,
  reviewTaskSubmission,
  getTaskSubmissions,
  submitProject,
  reviewProjectSubmission,
};