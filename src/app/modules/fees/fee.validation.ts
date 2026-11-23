import { z } from "zod";

// ── shared ──────────────────────────────────────────────
const bool = z
  .enum(["true", "false"])
  .transform((v) => v === "true");

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10), // hard cap = 50
  order: z.enum(["asc", "desc"]).default("desc"),
};

const month = z.coerce.number().int().min(1).max(12);
const year = z.coerce.number().int().min(2000).max(2100);

// ── categories ──────────────────────────────────────────
export const categoryQuery = z.object({
  includeInactive: bool.optional(),
});

export const createCategoryBody = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  type: z.enum(["MONTHLY", "ONE_TIME"]).default("ONE_TIME"),
  amount: z.coerce.number().int().min(0).default(0),
});

export const updateCategoryBody = z
  .object({
    name: z.string().trim().min(2).max(60),
    description: z.string().trim().max(300).nullable(),
    amount: z.coerce.number().int().min(0),
    isActive: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

// ── dues ────────────────────────────────────────────────
export const duesQuery = z.object({
  ...pagination,
  sortBy: z.enum(["createdAt", "dueDate", "amount", "year"]).default("createdAt"),
  userId: z.string().optional(),
  categoryId: z.string().optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "WAIVED"]).optional(),
  year: year.optional(),
  month: month.optional(),
  overdue: bool.optional(),
  group: z.string().trim().optional(),
  semester: z.coerce.number().int().min(1).optional(),
  search: z.string().trim().min(1).max(60).optional(),
});

export const generateMonthlyBody = z.object({
  categoryId: z.string().min(1),
  year,
  month,
  dueDate: z.coerce.date().optional(),
  group: z.string().trim().optional(),
  semester: z.coerce.number().int().min(1).optional(),
});

export const createDueBody = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().max(120).optional(),
  amount: z.coerce.number().int().min(1).optional(), // defaults to category amount
  dueDate: z.coerce.date().optional(),
  note: z.string().trim().max(300).optional(),
  userIds: z.array(z.string()).max(1000).optional(),
  group: z.string().trim().optional(),
  semester: z.coerce.number().int().min(1).optional(),
});

export const waiveBody = z.object({
  note: z.string().trim().max(300).optional(),
});

// ── payments ────────────────────────────────────────────
export const paymentsQuery = z.object({
  ...pagination,
  sortBy: z.enum(["paidAt", "amount", "receiptNo"]).default("paidAt"),
  userId: z.string().optional(),
  categoryId: z.string().optional(),
  dueId: z.string().optional(),
  status: z.enum(["RECEIVED", "VOIDED"]).optional(),
  receivedById: z.string().optional(),
  receiptNo: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().min(1).max(60).optional(),
});

export const recordPaymentBody = z
  .object({
    dueId: z.string().optional(),
    userId: z.string().optional(),
    categoryId: z.string().optional(),
    amount: z.coerce.number().int().min(1),
    paidAt: z.coerce.date().optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.dueId || (v.userId && v.categoryId), {
    message: "Provide dueId, or userId + categoryId for a standalone payment",
  });

export const voidBody = z.object({
  reason: z.string().trim().min(3).max(300),
});

// ── summary ─────────────────────────────────────────────
export const summaryQuery = z.object({
  year: year.optional(),
  month: month.optional(),
});

export const idParam = z.object({ id: z.string().min(1) });

export type DuesQuery = z.infer<typeof duesQuery>;
export type PaymentsQuery = z.infer<typeof paymentsQuery>;
export type RecordPaymentBody = z.infer<typeof recordPaymentBody>;
export type GenerateMonthlyBody = z.infer<typeof generateMonthlyBody>;
export type CreateDueBody = z.infer<typeof createDueBody>;