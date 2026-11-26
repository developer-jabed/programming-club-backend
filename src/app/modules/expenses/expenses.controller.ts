import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse.js";
import type { JwtPayload } from "../auth/auth.interface.js";
import { ExpenseService } from "./expenses.service.js";
import type {
  ICreateExpense,
  ICreateExpenseCategory,
  IUpdateExpenseCategory,
  IVoidExpense,
  IExpenseQuery,
  IFundSummaryQuery,
} from "./expenses.interface.js";

const isStaff = (role: string) => role === "ADMIN" || role === "MODERATOR";

// ==================== Categories ====================

const getCategories = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = req.user as JwtPayload;
  const { includeInactive } = req.query as { includeInactive?: string };

  const result = await ExpenseService.getCategories(
    (includeInactive === "true" || includeInactive === "1") &&
      isStaff(user.role)
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Expense categories retrieved successfully",
    data: result,
  });
};

const createCategory = async (
  req: FastifyRequest<{ Body: ICreateExpenseCategory }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await ExpenseService.createCategory(user.role, req.body);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Expense category created successfully",
    data: result,
  });
};

const updateCategory = async (
  req: FastifyRequest<{
    Params: { id: string };
    Body: IUpdateExpenseCategory;
  }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await ExpenseService.updateCategory(
    user.role,
    req.params.id,
    req.body
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Expense category updated successfully",
    data: result,
  });
};

// ==================== Expenses ====================

const recordExpense = async (
  req: FastifyRequest<{ Body: ICreateExpense }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await ExpenseService.recordExpense(
    user.id,
    user.role,
    req.body
  );

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Expense recorded successfully",
    data: result,
  });
};

const getExpenses = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = req.user as JwtPayload;
  const result = await ExpenseService.getExpenses(
    req.query as IExpenseQuery & Record<string, any>,
    user
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Expenses retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getExpenseById = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await ExpenseService.getExpenseById(req.params.id, user);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Expense retrieved successfully",
    data: result,
  });
};

const voidExpense = async (
  req: FastifyRequest<{ Params: { id: string }; Body: IVoidExpense }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await ExpenseService.voidExpense(
    req.params.id,
    req.body?.reason,
    user.id,
    user.role
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Expense voided successfully",
    data: result,
  });
};

// ==================== Fund summary ====================

const getFundSummary = async (req: FastifyRequest, reply: FastifyReply) => {
  const result = await ExpenseService.getFundSummary(
    req.query as IFundSummaryQuery
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fund summary retrieved successfully",
    data: result,
  });
};

export const ExpenseController = {
  getCategories,
  createCategory,
  updateCategory,
  recordExpense,
  getExpenses,
  getExpenseById,
  voidExpense,
  getFundSummary,
};