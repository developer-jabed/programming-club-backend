import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { TaskSubmissionService } from "./task.submission.service.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../helper/pick.js";
import type { JwtPayload } from "../auth/auth.interface.js";

const actorOf = (req: FastifyRequest) => {
  const user = (req as any).user as JwtPayload;
  return { id: user.id, role: (user as any).role };
};

const submitTask = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id: userId } = actorOf(req);
  const { id } = req.params as { id: string };
  const result = await TaskSubmissionService.submitTask(id, userId, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Task submitted successfully",
    data: result,
  });
};

const updateSubmission = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id: userId } = actorOf(req);
  const { submissionId } = req.params as { submissionId: string };
  const result = await TaskSubmissionService.updateSubmission(
    submissionId,
    userId,
    req.body as any
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submission updated successfully",
    data: result,
  });
};

const deleteSubmission = async (req: FastifyRequest, reply: FastifyReply) => {
  const { submissionId } = req.params as { submissionId: string };
  const result = await TaskSubmissionService.deleteSubmission(submissionId, actorOf(req));

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submission deleted successfully",
    data: result,
  });
};

const getSingleSubmission = async (req: FastifyRequest, reply: FastifyReply) => {
  const { submissionId } = req.params as { submissionId: string };
  const result = await TaskSubmissionService.getSingleSubmission(
    submissionId,
    actorOf(req)
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submission retrieved successfully",
    data: result,
  });
};

const getMySubmissions = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id: userId } = actorOf(req);
  const filters = pick(req.query as any, ["status", "taskId"]);
  const result = await TaskSubmissionService.getMySubmissions(
    userId,
    filters,
    req.query as any
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My submissions retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getTaskSubmissions = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const filters = pick(req.query as any, ["searchTerm", "status", "userId"]);
  const result = await TaskSubmissionService.getTaskSubmissions(
    id,
    actorOf(req),
    filters,
    req.query as any
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submissions retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getSubmissionSummary = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const result = await TaskSubmissionService.getSubmissionSummary(id, actorOf(req));

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submission summary retrieved successfully",
    data: result,
  });
};

const reviewSubmission = async (req: FastifyRequest, reply: FastifyReply) => {
  const { submissionId } = req.params as { submissionId: string };
  const result = await TaskSubmissionService.reviewSubmission(
    submissionId,
    actorOf(req),
    req.body as any
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Submission reviewed successfully",
    data: result,
  });
};

export const TaskSubmissionController = {
  submitTask,
  updateSubmission,
  deleteSubmission,
  getSingleSubmission,
  getMySubmissions,
  getTaskSubmissions,
  getSubmissionSummary,
  reviewSubmission,
};