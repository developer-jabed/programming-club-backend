import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { TestService } from "./test.service.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../helper/pick.js";
import type { JwtPayload } from "../auth/auth.interface.js";

const createTest = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const result = await TestService.createTest(user.id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Test created successfully",
    data: result,
  });
};

const getAllTests = async (req: FastifyRequest, reply: FastifyReply) => {
  const filters = pick(req.query as any, [
    "searchTerm",
    "status",
    "projectId",
    "createdById",
  ]);
  const result = await TestService.getAllTests(filters, req.query as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tests retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getSingleTest = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const result = await TestService.getSingleTest(id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Test retrieved successfully",
    data: result,
  });
};

const updateTest = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await TestService.updateTest(id, user.id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Test updated successfully",
    data: result,
  });
};

const publishTest = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await TestService.publishTest(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Test published successfully",
    data: result,
  });
};

const deleteTest = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await TestService.deleteTest(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Test deleted successfully",
    data: result,
  });
};

const startAttempt = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await TestService.startAttempt(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Attempt started successfully",
    data: result,
  });
};

const submitAttempt = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await TestService.submitAttempt(id, user.id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Test submitted successfully",
    data: result,
  });
};

const getMyAttempt = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await TestService.getMyAttempt(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attempt retrieved successfully",
    data: result,
  });
};

export const TestController = {
  createTest,
  getAllTests,
  getSingleTest,
  updateTest,
  publishTest,
  deleteTest,
  startAttempt,
  submitAttempt,
  getMyAttempt,
};