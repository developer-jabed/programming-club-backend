import {
  Prisma,
  UserRole,
  ExpenseStatus,
  PaymentStatus,
  type NotificationType,
} from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import { prisma } from "../../shared/prisma.js";
import { NotificationService } from "../notification/notification.service.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";
import type {
  ICreateExpense,
  ICreateExpenseCategory,
  IUpdateExpenseCategory,
  IExpenseQuery,
  IFundSummaryQuery,
} from "./expenses.interface.js";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const isAdminRole = (role: string) =>
  role === UserRole.ADMIN || role === UserRole.MODERATOR;

const bad = (message: string) => new ApiError(httpStatus.BAD_REQUEST, message);

const requireStaff = (role: string, action: string) => {
  if (!isAdminRole(role)) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `Only admins and moderators can ${action}`
    );
  }
};

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || `category-${Date.now()}`;
};

const parseDate = (value: string, field: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw bad(`Invalid ${field}`);
  return date;
};

const toInt = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
};

/** Fund balance = received payments − recorded expenses. */
const getBalance = async (db: Prisma.TransactionClient) => {
  const [income, spent] = await Promise.all([
    db.payment.aggregate({
      where: { status: PaymentStatus.RECEIVED },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { status: ExpenseStatus.RECORDED },
      _sum: { amount: true },
    }),
  ]);

  const collected = income._sum.amount ?? 0;
  const totalSpent = spent._sum.amount ?? 0;
  return { collected, spent: totalSpent, balance: collected - totalSpent };
};

const expenseInclude = {
  category: { select: { id: true, name: true, slug: true } },
  recordedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
  project: { select: { id: true, title: true } },
  sector: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseInclude;

/** Members see what was spent and why, but not who was paid or who recorded it. */
const mapExpense = (e: any, role: string) => {
  if (isAdminRole(role)) return e;
  const {
    paidTo,
    receiptUrl,
    recordedBy,
    recordedById,
    voidedBy,
    voidedById,
    voidReason,
    ...rest
  } = e;
  return rest;
};

// ─────────────────────────────────────────────────────────────
// Notifications
// Best-effort only: they never block or fail the main action.
// Types are cast so this compiles before the enum values exist. Until you add
// EXPENSE_RECORDED / EXPENSE_VOIDED / FUND_LOW to schema.prisma they fall back
// to SYSTEM (see TYPE_FALLBACKS in notification.service).
// ─────────────────────────────────────────────────────────────

/** Fund balance (৳) at or below which staff get a "fund low" alert. */
const LOW_FUND_THRESHOLD = 5000;
/** Expenses at or above this amount (৳) are flagged as large. */
const LARGE_EXPENSE_THRESHOLD = 10000;

const EXPENSE_RECORDED = "EXPENSE_RECORDED" as NotificationType;
const EXPENSE_VOIDED = "EXPENSE_VOIDED" as NotificationType;
const FUND_LOW = "FUND_LOW" as NotificationType;

const money = (n: number) => `৳${n.toLocaleString("en-IN")}`;

const getStaffIds = async (excludeUserId?: string) => {
  const staff = await prisma.user.findMany({
    where: {
      role: { in: [UserRole.ADMIN, UserRole.MODERATOR] },
      ...(excludeUserId && { id: { not: excludeUserId } }),
    },
    select: { id: true },
  });
  return staff.map((s) => s.id);
};

const getUserName = async (id: string) =>
  (await prisma.user.findUnique({ where: { id }, select: { name: true } }))
    ?.name ?? "Someone";

const notifyExpenseRecorded = async (args: {
  expenseId: string;
  title: string;
  amount: number;
  categoryName: string;
  recordedById: string;
  balanceBefore: number;
  balanceAfter: number;
  projectTitle?: string | null;
}) => {
  try {
    const { amount, balanceAfter, balanceBefore } = args;
    const [staffIds, actorName] = await Promise.all([
      getStaffIds(args.recordedById),
      getUserName(args.recordedById),
    ]);

    const isLarge = amount >= LARGE_EXPENSE_THRESHOLD;
    const where = args.projectTitle ? ` for ${args.projectTitle}` : "";

    await NotificationService.notifyManySafe(staffIds, {
      type: EXPENSE_RECORDED,
      title: isLarge ? "Large expense recorded" : "New expense recorded",
      body: `${actorName} recorded ${money(amount)} on "${args.title}" (${args.categoryName})${where}. Fund balance: ${money(balanceAfter)}.`,
      entityType: "EXPENSE",
      entityId: args.expenseId,
      metadata: {
        action: "recorded",
        amount,
        category: args.categoryName,
        balanceAfter,
        severity: isLarge ? "warning" : "info",
        actorId: args.recordedById,
        actorName,
      },
    });

    // Alert only when the balance crosses the threshold, so staff aren't spammed
    if (balanceBefore > LOW_FUND_THRESHOLD && balanceAfter <= LOW_FUND_THRESHOLD) {
      await NotificationService.notifyManySafe(await getStaffIds(), {
        type: FUND_LOW,
        title: "Fund balance is running low",
        body: `Available balance is now ${money(balanceAfter)}, at or below the ${money(LOW_FUND_THRESHOLD)} alert level.`,
        entityType: "FUND",
        metadata: {
          action: "fund_low",
          balance: balanceAfter,
          threshold: LOW_FUND_THRESHOLD,
          severity: "critical",
        },
      });
    }
  } catch (error) {
    console.error("[ExpenseService.notifyExpenseRecorded]", error);
  }
};

const notifyExpenseVoided = async (args: {
  expenseId: string;
  title: string;
  amount: number;
  reason: string;
  voidedById: string;
  recordedById: string;
}) => {
  try {
    const actorName = await getUserName(args.voidedById);
    const base = {
      type: EXPENSE_VOIDED,
      entityType: "EXPENSE",
      entityId: args.expenseId,
      metadata: {
        action: "voided",
        amount: args.amount,
        reason: args.reason,
        severity: "warning",
        actorId: args.voidedById,
        actorName,
      },
    };
    const body = `${actorName} voided "${args.title}" (${money(args.amount)}). Reason: ${args.reason}`;

    // The person who recorded it gets a personal message...
    if (args.recordedById !== args.voidedById) {
      await NotificationService.notifySafe({
        ...base,
        userId: args.recordedById,
        title: "Your expense was voided",
        body,
      });
    }

    // ...and the rest of the staff get the audit trail.
    const others = (await getStaffIds(args.voidedById)).filter(
      (id) => id !== args.recordedById
    );
    await NotificationService.notifyManySafe(others, {
      ...base,
      title: "Expense voided",
      body,
    });
  } catch (error) {
    console.error("[ExpenseService.notifyExpenseVoided]", error);
  }
};

const monthRange = (year: number, month?: number) => {
  if (month && month >= 1 && month <= 12) {
    return {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1)),
    };
  }
  return {
    gte: new Date(Date.UTC(year, 0, 1)),
    lt: new Date(Date.UTC(year + 1, 0, 1)),
  };
};

// ═════════════════════════════════════════════════════════════
// Categories
// ═════════════════════════════════════════════════════════════

const getCategories = async (includeInactive: boolean) => {
  return prisma.expenseCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });
};

const createCategory = async (
  userRole: string,
  payload: ICreateExpenseCategory
) => {
  requireStaff(userRole, "create expense categories");

  const name = payload.name?.trim();
  if (!name) throw bad("Name is required");

  try {
    return await prisma.expenseCategory.create({
      data: {
        name,
        slug: slugify(name),
        description: payload.description?.trim() || null,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new ApiError(httpStatus.CONFLICT, "Category already exists");
    }
    throw e;
  }
};

const updateCategory = async (
  userRole: string,
  id: string,
  payload: IUpdateExpenseCategory
) => {
  requireStaff(userRole, "update expense categories");

  const existing = await prisma.expenseCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
  }

  const data: Prisma.ExpenseCategoryUpdateInput = {};

  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (!name) throw bad("Name cannot be empty");
    data.name = name;
    data.slug = slugify(name);
  }
  if (payload.description !== undefined) {
    data.description = payload.description?.trim() || null;
  }
  if (payload.isActive !== undefined) data.isActive = payload.isActive;

  if (Object.keys(data).length === 0) throw bad("Nothing to update");

  try {
    return await prisma.expenseCategory.update({ where: { id }, data });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new ApiError(httpStatus.CONFLICT, "Category name already exists");
    }
    throw e;
  }
};

// ═════════════════════════════════════════════════════════════
// Expenses
// ═════════════════════════════════════════════════════════════

const recordExpense = async (
  userId: string,
  role: string,
  payload: ICreateExpense
) => {
  requireStaff(role, "record expenses");

  const title = payload.title?.trim();
  const description = payload.description?.trim();
  const amount = Number(payload.amount);

  if (!payload.categoryId) throw bad("Category is required");
  if (!title) throw bad("Title is required");
  if (title.length > 120) throw bad("Title must be 120 characters or less");
  if (!description || description.length < 3) {
    throw bad("Description is required (at least 3 characters)");
  }
  if (!Number.isInteger(amount) || amount < 1) {
    throw bad("Amount must be a whole number greater than 0");
  }

  const spentAt = payload.spentAt
    ? parseDate(payload.spentAt, "spent date")
    : undefined;

  try {
    let balanceBefore = 0;
    const expense = await prisma.$transaction(
      async (tx) => {
        const category = await tx.expenseCategory.findUnique({
          where: { id: payload.categoryId },
        });
        if (!category || !category.isActive) {
          throw bad("Invalid or inactive category");
        }

        const { balance } = await getBalance(tx);
        if (amount > balance) {
          throw bad(`Insufficient fund. Available balance: ৳${balance}`);
        }
        balanceBefore = balance;

        return tx.expense.create({
          data: {
            categoryId: payload.categoryId,
            title,
            description,
            amount,
            spentAt,
            paidTo: payload.paidTo?.trim() || null,
            receiptUrl: payload.receiptUrl?.trim() || null,
            projectId: payload.projectId || null,
            sectorId: payload.sectorId || null,
            recordedById: userId,
          },
          include: expenseInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Fire-and-forget: notification failures must never affect the response
    void notifyExpenseRecorded({
      expenseId: expense.id,
      title: expense.title,
      amount: expense.amount,
      categoryName: expense.category.name,
      recordedById: userId,
      balanceBefore,
      balanceAfter: balanceBefore - expense.amount,
      projectTitle: expense.project?.title,
    });

    return mapExpense(expense, role);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2034") {
        throw new ApiError(
          httpStatus.CONFLICT,
          "Another transaction was in progress. Please try again."
        );
      }
      if (e.code === "P2003") throw bad("Invalid project or sector");
    }
    throw e;
  }
};

const getExpenses = async (
  filters: IExpenseQuery & PaginationQuery,
  user: { id: string; role: string }
) => {
  const pagination = calculatePagination(filters, "spentAt");
  const { skip, take, sortBy, sortOrder } = pagination;
  const staff = isAdminRole(user.role);

  const and: Prisma.ExpenseWhereInput[] = [];

  // Members only see active (non-voided) expenses
  if (!staff) and.push({ status: ExpenseStatus.RECORDED });
  else if (filters.status) and.push({ status: filters.status });

  if (filters.categoryId) and.push({ categoryId: filters.categoryId });
  if (filters.projectId) and.push({ projectId: filters.projectId });
  if (filters.sectorId) and.push({ sectorId: filters.sectorId });

  const year = toInt(filters.year);
  const month = toInt(filters.month);
  if (year) and.push({ spentAt: monthRange(year, month) });

  if (filters.search) {
    const search = filters.search.trim();
    const or: Prisma.ExpenseWhereInput[] = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
    if (staff) or.push({ paidTo: { contains: search, mode: "insensitive" } });
    and.push({ OR: or });
  }

  const where: Prisma.ExpenseWhereInput = and.length ? { AND: and } : {};

  const [rows, total, sum] = await Promise.all([
    prisma.expense.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: expenseInclude,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({
      where: { AND: [where, { status: ExpenseStatus.RECORDED }] },
      _sum: { amount: true },
    }),
  ]);

  return {
    meta: buildPaginationMeta(total, pagination),
    data: rows.map((r) => mapExpense(r, user.role)),
    totalAmount: sum._sum.amount ?? 0,
  };
};

const getExpenseById = async (
  id: string,
  user: { id: string; role: string }
) => {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: expenseInclude,
  });

  if (
    !expense ||
    (!isAdminRole(user.role) && expense.status === ExpenseStatus.VOIDED)
  ) {
    throw new ApiError(httpStatus.NOT_FOUND, "Expense not found");
  }

  return mapExpense(expense, user.role);
};

const voidExpense = async (
  id: string,
  reason: string,
  userId: string,
  role: string
) => {
  requireStaff(role, "void expenses");

  const trimmed = reason?.trim();
  if (!trimmed || trimmed.length < 3) {
    throw bad("Reason is required (at least 3 characters)");
  }

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, "Expense not found");
  }
  if (existing.status === ExpenseStatus.VOIDED) {
    throw bad("Expense is already voided");
  }

  // Voiding returns the money to the fund, so no balance check is needed.
  const voided = await prisma.expense.update({
    where: { id },
    data: {
      status: ExpenseStatus.VOIDED,
      voidedAt: new Date(),
      voidedById: userId,
      voidReason: trimmed,
    },
    include: expenseInclude,
  });

  void notifyExpenseVoided({
    expenseId: voided.id,
    title: voided.title,
    amount: voided.amount,
    reason: trimmed,
    voidedById: userId,
    recordedById: existing.recordedById,
  });

  return voided;
};

// ═════════════════════════════════════════════════════════════
// Fund summary
// ═════════════════════════════════════════════════════════════

const getFundSummary = async (query: IFundSummaryQuery) => {
  const year = toInt(query.year) ?? new Date().getUTCFullYear();
  const range = monthRange(year);

  const [totals, expenseCount, grouped, categories, payments, expenses] =
    await Promise.all([
      getBalance(prisma),
      prisma.expense.count({ where: { status: ExpenseStatus.RECORDED } }),
      prisma.expense.groupBy({
        by: ["categoryId"],
        where: { status: ExpenseStatus.RECORDED },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.expenseCategory.findMany({ select: { id: true, name: true } }),
      prisma.payment.findMany({
        where: { status: PaymentStatus.RECEIVED, paidAt: range },
        select: { amount: true, paidAt: true },
      }),
      prisma.expense.findMany({
        where: { status: ExpenseStatus.RECORDED, spentAt: range },
        select: { amount: true, spentAt: true },
      }),
    ]);

  const names = new Map(categories.map((c) => [c.id, c.name]));

  const byCategory = grouped
    .map((g) => ({
      categoryId: g.categoryId,
      name: names.get(g.categoryId) ?? "Unknown",
      total: g._sum.amount ?? 0,
      count: g._count._all,
    }))
    .sort((a, b) => b.total - a.total);

  const byMonth = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    collected: 0,
    spent: 0,
  }));
  for (const p of payments) byMonth[p.paidAt.getUTCMonth()].collected += p.amount;
  for (const e of expenses) byMonth[e.spentAt.getUTCMonth()].spent += e.amount;

  return {
    ...totals,
    expenseCount,
    byCategory,
    year,
    byMonth,
  };
};

export const ExpenseService = {
  getCategories,
  createCategory,
  updateCategory,
  recordExpense,
  getExpenses,
  getExpenseById,
  voidExpense,
  getFundSummary,
};