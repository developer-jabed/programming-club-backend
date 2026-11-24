import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse.js";
import type { JwtPayload } from "../auth/auth.interface.js";
import type {
  ICreateCategory,
  IUpdateCategory,
  ICreateDues,
  IGenerateMonthlyDues,
  IRecordPayment,
} from "./fees.interface.js";
import { FeeService } from "./fees.service.js";

// ==================== Categories ====================

const getCategories = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = req.user as JwtPayload;
  const { includeInactive } = req.query as { includeInactive?: boolean };

  const result = await FeeService.getCategories(
    !!includeInactive && user.role !== "MEMBER"
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Categories retrieved successfully",
    data: result,
  });
};

const createCategory = async (
  req: FastifyRequest<{ Body: ICreateCategory }>,
  reply: FastifyReply
) => {
  const result = await FeeService.createCategory(req.body);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Category created successfully  00",
    data: result,
  });
};

const updateCategory = async (
  req: FastifyRequest<{ Params: { id: string }; Body: IUpdateCategory }>,
  reply: FastifyReply
) => {
  const result = await FeeService.updateCategory(req.params.id, req.body);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
};

// ==================== Dues ====================

const getDues = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = req.user as JwtPayload;
  const result = await FeeService.getDues(req.query as any, user);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dues retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const generateMonthlyDues = async (
  req: FastifyRequest<{ Body: IGenerateMonthlyDues }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeeService.generateMonthlyDues(req.body, user);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Monthly dues generated successfully",
    data: result,
  });
};

const createDues = async (
  req: FastifyRequest<{ Body: ICreateDues }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeeService.createDues(req.body, user);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Dues created successfully",
    data: result,
  });
};

const waiveDue = async (
  req: FastifyRequest<{ Params: { id: string }; Body: { note?: string } }>,
  reply: FastifyReply
) => {
  const result = await FeeService.waiveDue(req.params.id, req.body?.note);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Due waived successfully",
    data: result,
  });
};

const deleteDue = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  await FeeService.deleteDue(req.params.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Due deleted successfully",
    data: null,
  });
};

// ==================== Payments ====================

const getPayments = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = req.user as JwtPayload;
  const result = await FeeService.getPayments(req.query as any, user);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getPaymentById = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeeService.getPaymentById(req.params.id, user);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment retrieved successfully",
    data: result,
  });
};

const recordPayment = async (
  req: FastifyRequest<{ Body: IRecordPayment }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeeService.recordPayment(req.body, user);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payment recorded successfully",
    data: result,
  });
};

const voidPayment = async (
  req: FastifyRequest<{ Params: { id: string }; Body: { reason: string } }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeeService.voidPayment(
    req.params.id,
    req.body.reason,
    user
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payment voided  successfully",
    data: result,
  });
};

// ==================== Summaries ====================

const getAdminSummary = async (req: FastifyRequest, reply: FastifyReply) => {
  const result = await FeeService.getAdminSummary(req.query as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Summary retrieved successfully",
    data: result,
  });
};

const getMySummary = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = req.user as JwtPayload;
  const result = await FeeService.getMySummary(user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Summary retrieved successfully",
    data: result,
  });
};

export const FeeController = {
  getCategories,
  createCategory,
  updateCategory,
  getDues,
  generateMonthlyDues,
  createDues,
  waiveDue,
  deleteDue,
  getPayments,
  getPaymentById,
  recordPayment,
  voidPayment,
  getAdminSummary,
  getMySummary,
};