import type { ExpenseStatus } from "@prisma/client";

export interface ICreateExpenseCategory {
  name: string;
  description?: string;
}

export interface IUpdateExpenseCategory {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ICreateExpense {
  categoryId: string;
  title: string;
  description: string;
  amount: number;
  spentAt?: string;
  paidTo?: string;
  receiptUrl?: string;
  projectId?: string;
  sectorId?: string;
}

export interface IVoidExpense {
  reason: string;
}

export interface IExpenseQuery {
  categoryId?: string;
  status?: ExpenseStatus;
  year?: string | number;
  month?: string | number;
  search?: string;
  projectId?: string;
  sectorId?: string;
}

export interface IFundSummaryQuery {
  year?: string | number;
}