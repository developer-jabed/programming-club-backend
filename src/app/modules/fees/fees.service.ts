import { Prisma, DueStatus } from "@prisma/client";
import { prisma } from "../../shared/prisma.js";
import { cached, invalidate } from "./fee.cache.js";
import {
  notifyPaymentReceived,
  notifyPaymentVoided,
  notifyDuesCreated,
  notifyDueWaived,
} from "./fee.notify.js";
import type {
  ICreateDues,
  IDuesQuery,
  IGenerateMonthlyDues,
  IPaymentsQuery,
  IRecordPayment,
  ISummaryQuery,
  ICreateCategory,
  IUpdateCategory,
} from "./fees.interface.js";
import ApiError from "../../errors/api.error.js";

// ─────────────────────────────────────────────────────────────
// Types, constants
// ─────────────────────────────────────────────────────────────
type Actor = { id: string; role: string };

const isStaff = (a: Actor) => a.role !== "MEMBER";

const TTL = {
  categories: 5 * 60_000,
  lists: 15_000,
  summary: 60_000,
};

const K = { cat: "fee:cat:", dues: "fee:dues:", pay: "fee:pay:", sum: "fee:sum:" };

export const formatReceiptNo = (n: number, date: Date | string = new Date()) =>
  `PC-${new Date(date).getFullYear()}-${String(n).padStart(6, "0")}`;

const dueStatus = (paid: number, amount: number): DueStatus =>
  paid >= amount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

const userBrief = {
  id: true,
  name: true,
  roll: true,
  group: true,
  semester: true,
  profilePicture: true,
} satisfies Prisma.UserSelect;

const dueSelect = {
  id: true,
  title: true,
  year: true,
  month: true,
  amount: true,
  paidAmount: true,
  status: true,
  dueDate: true,
  note: true,
  createdAt: true,
  user: { select: userBrief },
  category: { select: { id: true, name: true, type: true } },
} satisfies Prisma.DueSelect;

const paymentSelect = {
  id: true,
  receiptNo: true,
  amount: true,
  status: true,
  paidAt: true,
  note: true,
  voidedAt: true,
  voidReason: true,
  dueId: true,
  user: { select: userBrief },
  category: { select: { id: true, name: true, type: true } },
  receivedBy: { select: { id: true, name: true } },
  due: { select: { id: true, year: true, month: true, title: true } },
} satisfies Prisma.PaymentSelect;

const withReceipt = <T extends { receiptNo: number; paidAt: Date }>(p: T) => ({
  ...p,
  receipt: formatReceiptNo(p.receiptNo, p.paidAt),
});

const pageMeta = (page: number, limit: number, total: number) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

// Safer orderBy – never crash on unknown sort field
const ALLOWED_SORT = new Set(["createdAt", "dueDate", "amount", "year", "paidAt", "receiptNo"]);

const orderBy = (sortBy: string = "createdAt", order: "asc" | "desc" = "desc") => {
  const field = ALLOWED_SORT.has(sortBy) ? sortBy : "createdAt";
  const dir = order === "asc" ? "asc" : "desc";
  return [{ [field]: dir }, { id: "desc" }] as any;
};

const userFilter = (q: {
  search?: string;
  group?: string;
  semester?: number;
}): Prisma.UserWhereInput | undefined => {
  const f: Prisma.UserWhereInput = {};
  if (q.group) f.group = q.group;
  if (q.semester) f.semester = q.semester;
  if (q.search) {
    f.OR = [
      { name: { contains: q.search, mode: "insensitive" } },
      { roll: { contains: q.search, mode: "insensitive" } },
      { registration: { contains: q.search, mode: "insensitive" } },
    ];
  }
  return Object.keys(f).length ? f : undefined;
};

const stableKey = (prefix: string, obj: unknown) =>
  `${prefix}${JSON.stringify(obj, Object.keys(obj as object).sort())}`;

// ═════════════════════════════════════════════════════════════
// CATEGORIES
// ═════════════════════════════════════════════════════════════
const getCategories = (includeInactive = false) =>
  cached(
    `${K.cat}${includeInactive}`,
    TTL.categories,
    () =>
      prisma.paymentCategory.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      })
  );

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function createCategory(data: ICreateCategory) {
  const slug = slugify(data.name);
  const exists = await prisma.paymentCategory.findFirst({
    where: { OR: [{ name: data.name }, { slug }] },
    select: { id: true },
  });
  if (exists) throw new ApiError(409, "A category with this name already exists");

  const created = await prisma.paymentCategory.create({ data: { ...data, slug } });
  invalidate(K.cat);
  return created;
}

async function updateCategory(id: string, data: IUpdateCategory) {
  const found = await prisma.paymentCategory.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!found) throw new ApiError(404, "Category not found");

  const updated = await prisma.paymentCategory.update({ where: { id }, data });
  invalidate(K.cat);
  return updated;
}

// ═════════════════════════════════════════════════════════════
// DUES
// ═════════════════════════════════════════════════════════════
async function getDues(q: IDuesQuery, actor: Actor) {
  const staff = isStaff(actor);
  const scopedUser = staff ? q.userId : actor.id;

  const where: Prisma.DueWhereInput = {
    ...(scopedUser && { userId: scopedUser }),
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.year && { year: q.year }),
    ...(q.month && { month: q.month }),
    ...(q.overdue
      ? {
          status: { in: ["UNPAID", "PARTIAL"] },
          dueDate: { lt: new Date() },
        }
      : q.status
        ? { status: q.status }
        : {}),
    ...(staff && userFilter(q) && { user: userFilter(q) }),
  };

  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(50, Math.max(1, q.limit ?? 20));

  const key = stableKey(K.dues, {
    ...q,
    page,
    limit,
    scope: scopedUser ?? "all",
  });

  return cached(key, TTL.lists, async () => {
    const skip = (page - 1) * limit;

    const [data, total] = await prisma.$transaction([
      prisma.due.findMany({
        where,
        select: dueSelect,
        orderBy: orderBy(q.sortBy, q.order),
        skip,
        take: limit,
      }),
      prisma.due.count({ where }),
    ]);

    return {
      data,
      meta: pageMeta(page, limit, total),
    };
  });
}

async function resolveTargets(f: {
  userIds?: string[];
  group?: string;
  semester?: number;
}) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      ...(f.userIds?.length && { id: { in: f.userIds } }),
      ...(f.group && { group: f.group }),
      ...(f.semester && { semester: f.semester }),
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function createManyChunked(rows: Prisma.DueCreateManyInput[]) {
  let created = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const res = await prisma.due.createMany({
      data: rows.slice(i, i + 1000),
      skipDuplicates: true,
    });
    created += res.count;
  }
  return created;
}

async function generateMonthlyDues(body: IGenerateMonthlyDues, actor: Actor) {
  const category = await prisma.paymentCategory.findUnique({
    where: { id: body.categoryId },
  });
  if (!category || !category.isActive) throw new ApiError(404, "Category not found");
  if (category.type !== "MONTHLY")
    throw new ApiError(400, "Category is not a monthly category");
  if (category.amount <= 0)
    throw new ApiError(400, "Set an amount on the category first");

  const userIds = await resolveTargets(body);
  if (!userIds.length) throw new ApiError(404, "No active members matched");

  const rows = userIds.map((userId) => ({
    userId,
    categoryId: category.id,
    year: body.year,
    month: body.month,
    amount: category.amount,
    dueDate: body.dueDate,
    createdById: actor.id,
  }));

  const created = await createManyChunked(rows);
  invalidate(K.dues, K.sum);

  // ── Classy notification ────────────────────────────────────
  if (created > 0) {
    void notifyDuesCreated(userIds, {
      title: category.name,
      amount: category.amount,
      dueDate: body.dueDate,
      categoryName: category.name,
      year: body.year,
      month: body.month,
    });
  }

  return { created, skipped: rows.length - created, totalMembers: rows.length };
}

async function createDues(body: ICreateDues, actor: Actor) {
  const category = await prisma.paymentCategory.findUnique({
    where: { id: body.categoryId },
  });
  if (!category || !category.isActive) throw new ApiError(404, "Category not found");

  const amount = body.amount ?? category.amount;
  if (amount <= 0) throw new ApiError(400, "Amount is required");

  const userIds = await resolveTargets(body);
  if (!userIds.length) throw new ApiError(404, "No active members matched");

  const created = await createManyChunked(
    userIds.map((userId) => ({
      userId,
      categoryId: category.id,
      title: body.title ?? category.name,
      amount,
      dueDate: body.dueDate,
      note: body.note,
      createdById: actor.id,
    }))
  );
  invalidate(K.dues, K.sum);

  // ── Classy notification ────────────────────────────────────
  if (created > 0) {
    void notifyDuesCreated(userIds, {
      title: body.title ?? category.name,
      amount,
      dueDate: body.dueDate,
      categoryName: category.name,
    });
  }

  return { created };
}

async function waiveDue(id: string, note?: string) {
  const due = await prisma.due.findUnique({ where: { id } });
  if (!due) throw new ApiError(404, "Due not found");
  if (due.status === "PAID") throw new ApiError(409, "Due is already paid");
  if (due.status === "WAIVED") throw new ApiError(409, "Due is already waived");

  const updated = await prisma.due.update({
    where: { id },
    data: { status: "WAIVED", ...(note && { note }) },
    select: dueSelect,
  });
  invalidate(K.dues, K.sum);

  // ── Classy notification ────────────────────────────────────
  void notifyDueWaived({
    id: updated.id,
    userId: updated.user.id,
    title: updated.title,
    amount: updated.amount,
    note: note ?? updated.note,
  });

  return updated;
}

async function deleteDue(id: string) {
  const due = await prisma.due.findUnique({
    where: { id },
    select: { id: true, paidAmount: true, _count: { select: { payments: true } } },
  });
  if (!due) throw new ApiError(404, "Due not found");
  if (due.paidAmount > 0 || due._count.payments > 0)
    throw new ApiError(409, "This due has payments. Void them first, or waive the due.");

  await prisma.due.delete({ where: { id } });
  invalidate(K.dues, K.sum);
}

// ═════════════════════════════════════════════════════════════
// PAYMENTS
// ═════════════════════════════════════════════════════════════
async function getPayments(q: IPaymentsQuery, actor: Actor) {
  const staff = isStaff(actor);
  const scopedUser = staff ? q.userId : actor.id;

  const where: Prisma.PaymentWhereInput = {
    ...(scopedUser && { userId: scopedUser }),
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.dueId && { dueId: q.dueId }),
    ...(q.status && { status: q.status }),
    ...(q.receiptNo && { receiptNo: q.receiptNo }),
    ...(staff && q.receivedById && { receivedById: q.receivedById }),
    ...((q.from || q.to) && {
      paidAt: {
        ...(q.from && { gte: q.from }),
        ...(q.to && { lte: q.to }),
      },
    }),
    ...(staff &&
      userFilter({ search: q.search }) && {
        user: userFilter({ search: q.search }),
      }),
  };

  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(50, Math.max(1, q.limit ?? 20));

  const key = stableKey(K.pay, {
    ...q,
    page,
    limit,
    scope: scopedUser ?? "all",
  });

  return cached(key, TTL.lists, async () => {
    const skip = (page - 1) * limit;

    const [rows, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        select: paymentSelect,
        orderBy: orderBy(q.sortBy, q.order),
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      data: rows.map(withReceipt),
      meta: pageMeta(page, limit, total),
    };
  });
}

async function getPaymentById(id: string, actor: Actor) {
  const p = await prisma.payment.findUnique({
    where: { id },
    select: paymentSelect,
  });
  if (!p || (!isStaff(actor) && p.user.id !== actor.id))
    throw new ApiError(404, "Payment not found");
  return withReceipt(p);
}

async function recordPayment(input: IRecordPayment, actor: Actor) {
  const payment = await prisma.$transaction(
    async (tx) => {
      let userId = input.userId!;
      let categoryId = input.categoryId!;
      const dueId = input.dueId ?? null;

      if (dueId) {
        await tx.$queryRaw`SELECT id FROM dues WHERE id = ${dueId} FOR UPDATE`;
        const due = await tx.due.findUnique({ where: { id: dueId } });
        if (!due) throw new ApiError(404, "Due not found");
        if (due.status === "PAID")
          throw new ApiError(409, "Due is already fully paid");
        if (due.status === "WAIVED")
          throw new ApiError(409, "Due has been waived");

        const remaining = due.amount - due.paidAmount;
        if (input.amount > remaining)
          throw new ApiError(400, `Amount exceeds the remaining due (${remaining})`);

        userId = due.userId;
        categoryId = due.categoryId;

        const paid = due.paidAmount + input.amount;
        await tx.due.update({
          where: { id: dueId },
          data: { paidAmount: paid, status: dueStatus(paid, due.amount) },
        });
      } else {
        const [user, category] = await Promise.all([
          tx.user.findUnique({ where: { id: userId }, select: { id: true } }),
          tx.paymentCategory.findUnique({
            where: { id: categoryId },
            select: { id: true, isActive: true },
          }),
        ]);
        if (!user) throw new ApiError(404, "Member not found");
        if (!category || !category.isActive)
          throw new ApiError(404, "Category not found");
      }

      return tx.payment.create({
        data: {
          userId,
          categoryId,
          dueId,
          amount: input.amount,
          paidAt: input.paidAt,
          note: input.note,
          receivedById: actor.id,
        },
        select: paymentSelect,
      });
    },
    { timeout: 10_000 }
  );

  invalidate(K.dues, K.pay, K.sum);

  const result = withReceipt(payment);
  void notifyPaymentReceived(result);

  return result;
}

async function voidPayment(id: string, reason: string, actor: Actor) {
  const voided = await prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new ApiError(404, "Payment not found");
      if (payment.status === "VOIDED")
        throw new ApiError(409, "Payment is already voided");

      if (payment.dueId) {
        await tx.$queryRaw`SELECT id FROM dues WHERE id = ${payment.dueId} FOR UPDATE`;
        const due = await tx.due.findUnique({ where: { id: payment.dueId } });
        if (due) {
          const paid = Math.max(0, due.paidAmount - payment.amount);
          await tx.due.update({
            where: { id: due.id },
            data: {
              paidAmount: paid,
              ...(due.status !== "WAIVED" && {
                status: dueStatus(paid, due.amount),
              }),
            },
          });
        }
      }

      return tx.payment.update({
        where: { id },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidedById: actor.id,
          voidReason: reason,
        },
        select: paymentSelect,
      });
    },
    { timeout: 10_000 }
  );

  invalidate(K.dues, K.pay, K.sum);

  // ── Classy notification ────────────────────────────────────
  void notifyPaymentVoided({
    id: voided.id,
    amount: voided.amount,
    receipt: formatReceiptNo(voided.receiptNo, voided.paidAt),
    paidAt: voided.paidAt,
    userId: voided.user.id,
    voidReason: reason,
  });

  return withReceipt(voided);
}

// ═════════════════════════════════════════════════════════════
// SUMMARIES
// ═════════════════════════════════════════════════════════════
function getAdminSummary(q: ISummaryQuery) {
  return cached(stableKey(K.sum + "admin:", q), TTL.summary, async () => {
    const dueWhere: Prisma.DueWhereInput = {
      ...(q.year && { year: q.year }),
      ...(q.month && { month: q.month }),
    };

    let paidAt: Prisma.DateTimeFilter | undefined;
    if (q.year && q.month) {
      paidAt = {
        gte: new Date(q.year, q.month - 1, 1),
        lt: new Date(q.year, q.month, 1),
      };
    } else if (q.year) {
      paidAt = {
        gte: new Date(q.year, 0, 1),
        lt: new Date(q.year + 1, 0, 1),
      };
    }

    const [byStatus, collected, overdue] = await Promise.all([
      prisma.due.groupBy({
        by: ["status"],
        where: dueWhere,
        _count: { _all: true },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.payment.aggregate({
        where: { status: "RECEIVED", ...(paidAt && { paidAt }) },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.due.count({
        where: {
          ...dueWhere,
          status: { in: ["UNPAID", "PARTIAL"] },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    const statuses = Object.fromEntries(
      byStatus.map((s) => [
        s.status,
        { count: s._count._all, amount: s._sum.amount ?? 0 },
      ])
    );

    const totalDue = byStatus
      .filter((s) => s.status !== "WAIVED")
      .reduce((n, s) => n + (s._sum.amount ?? 0), 0);

    const totalPaidOnDues = byStatus
      .filter((s) => s.status !== "WAIVED")
      .reduce((n, s) => n + (s._sum.paidAmount ?? 0), 0);

    return {
      collected: collected._sum.amount ?? 0,
      paymentCount: collected._count._all,
      totalDue,
      outstanding: Math.max(0, totalDue - totalPaidOnDues),
      overdueCount: overdue,
      dues: statuses,
    };
  });
}

function getMySummary(userId: string) {
  return cached(`${K.sum}member:${userId}`, 30_000, async () => {
    const [byStatus, upcoming] = await Promise.all([
      prisma.due.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.due.findMany({
        where: { userId, status: { in: ["UNPAID", "PARTIAL"] } },
        select: dueSelect,
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        take: 5,
      }),
    ]);

    const live = byStatus.filter((s) => s.status !== "WAIVED");
    const totalDue = live.reduce((n, s) => n + (s._sum.amount ?? 0), 0);
    const totalPaid = live.reduce((n, s) => n + (s._sum.paidAmount ?? 0), 0);

    return {
      totalDue,
      totalPaid,
      outstanding: Math.max(0, totalDue - totalPaid),
      upcoming,
    };
  });
}

export const FeeService = {
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