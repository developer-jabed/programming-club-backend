import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodType } from "zod";
import { UserRole } from "@prisma/client";
import { FeeController } from "./fees.controller.js";
import type {
  ICreateCategory,
  IUpdateCategory,
  ICreateDues,
  IGenerateMonthlyDues,
  IRecordPayment,
} from "./fees.interface.js";
import auth from "../../middlewares/auth.middleware.js";
import {
  categoryQuery,
  createCategoryBody,
  updateCategoryBody,
  duesQuery,
  generateMonthlyBody,
  createDueBody,
  waiveBody,
  paymentsQuery,
  recordPaymentBody,
  voidBody,
  summaryQuery,
  idParam,
} from "./fee.validation.js";

/**
 * Parses req.query / req.body / req.params with zod and writes the parsed
 * value (defaults applied, numbers coerced) back onto the request, so the
 * controller and service always receive clean input.
 * A ZodError is thrown on bad input; your global error handler should return 400.
 */
const validate =
  (schema: ZodType, part: "query" | "body" | "params" = "body") =>
  async (req: FastifyRequest, _reply: FastifyReply) => {
    (req as any)[part] = schema.parse((req as any)[part] ?? {});
  };

type IdParams = { id: string };

const STAFF = [UserRole.ADMIN, UserRole.MODERATOR] as const;
const ALL = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER] as const;

/**
 * Register with a prefix, e.g. fastify.register(feeRoutes, { prefix: "/fees" })
 *
 * MEMBER     -> own dues, own payments, own summary, active categories
 * MODERATOR  -> all members' dues/payments, record payments, generate dues
 * ADMIN      -> everything, plus void payments, waive/delete dues, manage categories
 */
export default async function feeRoutes(fastify: FastifyInstance) {
  // ==================== Categories ====================

  // List categories → All authenticated (members only see active ones)
  fastify.get(
    "/categories",
    {
      preHandler: [auth(...ALL)],
      preValidation: [validate(categoryQuery, "query")],
    },
    FeeController.getCategories
  );

  // Create category → Only Admin
  fastify.post<{ Body: ICreateCategory }>(
    "/categories",
    {
      preHandler: [auth(UserRole.ADMIN)],
      preValidation: [validate(createCategoryBody)],
    },
    FeeController.createCategory
  );

  // Update category → Only Admin
  fastify.patch<{ Params: IdParams; Body: IUpdateCategory }>(
    "/categories/:id",
    {
      preHandler: [auth(UserRole.ADMIN)],
      preValidation: [validate(idParam, "params"), validate(updateCategoryBody)],
    },
    FeeController.updateCategory
  );

  // ==================== Dues ====================

  // List dues → All authenticated (members are auto-scoped to their own)
  fastify.get(
    "/dues",
    {
      preHandler: [auth(...ALL)],
      preValidation: [validate(duesQuery, "query")],
    },
    FeeController.getDues
  );

  // Generate monthly dues → Admin & Moderator
  fastify.post<{ Body: IGenerateMonthlyDues }>(
    "/dues/generate-monthly",
    {
      preHandler: [auth(...STAFF)],
      preValidation: [validate(generateMonthlyBody)],
    },
    FeeController.generateMonthlyDues
  );

  // Create one-time dues → Admin & Moderator
  fastify.post<{ Body: ICreateDues }>(
    "/dues",
    {
      preHandler: [auth(...STAFF)],
      preValidation: [validate(createDueBody)],
    },
    FeeController.createDues
  );

  // Waive due → Only Admin
  fastify.patch<{ Params: IdParams; Body: { note?: string } }>(
    "/dues/:id/waive",
    {
      preHandler: [auth(UserRole.ADMIN)],
      preValidation: [validate(idParam, "params"), validate(waiveBody)],
    },
    FeeController.waiveDue
  );

  // Delete due → Only Admin
  fastify.delete<{ Params: IdParams }>(
    "/dues/:id",
    {
      preHandler: [auth(UserRole.ADMIN)],
      preValidation: [validate(idParam, "params")],
    },
    FeeController.deleteDue
  );

  // ==================== Payments (offline / cash) ====================

  // List payments → All authenticated (members are auto-scoped to their own)
  fastify.get(
    "/payments",
    {
      preHandler: [auth(...ALL)],
      preValidation: [validate(paymentsQuery, "query")],
    },
    FeeController.getPayments
  );

  // Get single payment / receipt → All authenticated (members: own only)
  fastify.get<{ Params: IdParams }>(
    "/payments/:id",
    {
      preHandler: [auth(...ALL)],
      preValidation: [validate(idParam, "params")],
    },
    FeeController.getPaymentById
  );

  // Record payment → Admin & Moderator
  fastify.post<{ Body: IRecordPayment }>(
    "/payments",
    {
      preHandler: [auth(...STAFF)],
      preValidation: [validate(recordPaymentBody)],
    },
    FeeController.recordPayment
  );

  // Void payment → Only Admin
  fastify.patch<{ Params: IdParams; Body: { reason: string } }>(
    "/payments/:id/void",
    {
      preHandler: [auth(UserRole.ADMIN)],
      preValidation: [validate(idParam, "params"), validate(voidBody)],
    },
    FeeController.voidPayment
  );

  // ==================== Summaries ====================

  // Admin summary → Admin & Moderator
  fastify.get(
    "/summary",
    {
      preHandler: [auth(...STAFF)],
      preValidation: [validate(summaryQuery, "query")],
    },
    FeeController.getAdminSummary
  );

  // My summary → All authenticated
  fastify.get(
    "/my-summary",
    {
      preHandler: [auth(...ALL)],
    },
    FeeController.getMySummary
  );
}