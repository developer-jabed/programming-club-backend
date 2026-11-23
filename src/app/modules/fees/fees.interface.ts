import type { z } from "zod";
import type {
  createCategoryBody,
  updateCategoryBody,
  duesQuery,
  generateMonthlyBody,
  createDueBody,
  paymentsQuery,
  recordPaymentBody,
  summaryQuery,
} from "./fee.validation.js";

// Types are inferred from the zod schemas, so validation and typing never drift apart.
export type ICreateCategory = z.infer<typeof createCategoryBody>;
export type IUpdateCategory = z.infer<typeof updateCategoryBody>;
export type IDuesQuery = z.infer<typeof duesQuery>;
export type IGenerateMonthlyDues = z.infer<typeof generateMonthlyBody>;
export type ICreateDues = z.infer<typeof createDueBody>;
export type IPaymentsQuery = z.infer<typeof paymentsQuery>;
export type IRecordPayment = z.infer<typeof recordPaymentBody>;
export type ISummaryQuery = z.infer<typeof summaryQuery>;