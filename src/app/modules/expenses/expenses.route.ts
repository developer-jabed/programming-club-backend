import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth.middleware.js";
import { ExpenseController } from "./expenses.controller.js";
import type {
  ICreateExpense,
  ICreateExpenseCategory,
  IUpdateExpenseCategory,
  IVoidExpense,
} from "./expenses.interface.js";

export default async function expenseRoutes(fastify: FastifyInstance) {
  // ==================== Fund summary (any logged-in member) ====================

  fastify.get(
    "/fund-summary",
    { preHandler: [auth()] },
    ExpenseController.getFundSummary
  );

  // ==================== Categories ====================

  fastify.get(
    "/categories",
    { preHandler: [auth()] },
    ExpenseController.getCategories
  );

  fastify.post<{ Body: ICreateExpenseCategory }>(
    "/categories",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)] },
    ExpenseController.createCategory
  );

  fastify.patch<{ Params: { id: string }; Body: IUpdateExpenseCategory }>(
    "/categories/:id",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)] },
    ExpenseController.updateCategory
  );

  // ==================== Expenses ====================

  fastify.post<{ Body: ICreateExpense }>(
    "/",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)] },
    ExpenseController.recordExpense
  );

  fastify.get("/", { preHandler: [auth()] }, ExpenseController.getExpenses);

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [auth()] },
    ExpenseController.getExpenseById
  );

  fastify.patch<{ Params: { id: string }; Body: IVoidExpense }>(
    "/:id/void",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)] },
    ExpenseController.voidExpense
  );
}

/*
 * Register in your routes file, next to the feature and fees routes:
 *
 *   import expenseRoutes from "../modules/expenses/expense.route.js";
 *   fastify.register(expenseRoutes, { prefix: "/expenses" });
 */