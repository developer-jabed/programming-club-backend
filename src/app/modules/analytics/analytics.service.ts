import { prisma } from "../../shared/prisma.js";
import {
  UserRole,
  UserStatus,
  ProjectStatus,
  TaskStatus,
  TestStatus,
  SubmissionStatus,
} from "@prisma/client";

const getDashboardStats = async () => {
  const [
    totalUsers,
    totalMembers,
    totalModerators,
    totalAdmins,
    activeUsers,
    totalProjects,
    openProjects,
    completedProjects,
    totalTasks,
    completedTasks,
    totalTests,
    publishedTests,
    totalSubmissions,
    pendingSubmissions,
    totalSectors,
    activeSectors,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.MEMBER } }),
    prisma.user.count({ where: { role: UserRole.MODERATOR } }),
    prisma.user.count({ where: { role: UserRole.ADMIN } }),
    prisma.user.count({ where: { status: UserStatus.ACTIVE } }),

    prisma.project.count(),
    prisma.project.count({ where: { status: ProjectStatus.OPEN } }),
    prisma.project.count({ where: { status: ProjectStatus.COMPLETED } }),

    prisma.task.count(),
    prisma.task.count({ where: { status: TaskStatus.COMPLETED } }),

    prisma.test.count(),
    prisma.test.count({ where: { status: TestStatus.PUBLISHED } }),

    prisma.taskSubmission.count(),
    prisma.taskSubmission.count({ where: { status: "SUBMITTED" } }),

    prisma.sector.count(),
    prisma.sector.count({ where: { isActive: true } }),
  ]);

  return {
    users: {
      total: totalUsers,
      members: totalMembers,
      moderators: totalModerators,
      admins: totalAdmins,
      active: activeUsers,
    },
    projects: {
      total: totalProjects,
      open: openProjects,
      completed: completedProjects,
    },
    tasks: {
      total: totalTasks,
      completed: completedTasks,
      completionRate:
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    tests: {
      total: totalTests,
      published: publishedTests,
    },
    submissions: {
      total: totalSubmissions,
      pending: pendingSubmissions,
    },
    sectors: {
      total: totalSectors,
      active: activeSectors,
    },
  };
};

const getRecentActivities = async (limit = 10) => {
  // limit often arrives from the query string as text; Prisma needs a number
  const take = Math.min(Math.max(Math.trunc(Number(limit)) || 10, 1), 50);

  const [recentProjects, recentTasks, recentSubmissions, recentUsers] =
    await Promise.all([
      prisma.project.findMany({
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          owner: { select: { id: true, name: true } },
          sector: { select: { id: true, name: true } },
        },
      }),
      prisma.task.findMany({
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true } },
          sector: { select: { id: true, name: true } },
        },
      }),
      prisma.taskSubmission.findMany({
        take,
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          user: { select: { id: true, name: true } },
          task: { select: { id: true, title: true } },
        },
      }),
      prisma.user.findMany({
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    ]);

  return {
    recentProjects,
    recentTasks,
    recentSubmissions,
    recentUsers,
  };
};

/**
 * Leaderboard = sum of the marks each member got per task.
 *
 * A mark can live in two places in your schema:
 *   - TaskAssignment.score   (set when the assignment itself is graded)
 *   - TaskSubmission.score   (set when a submission is reviewed)
 * The old version only read TaskAssignment.score of COMPLETED assignments,
 * so marks given on a submission (or on an assignment that was not switched to
 * COMPLETED) were counted as 0.
 *
 * Per (user, task) we count ONE mark:
 *   assignment score  →  otherwise the latest non-rejected submission score.
 */
const getUserLeaderboard = async (limit = 10) => {
  const take = Math.min(Math.max(Math.trunc(Number(limit)) || 10, 1), 100);

  const [users, assignments, submissions] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.MEMBER, status: UserStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        profilePicture: true,
        group: true,
        semester: true,
        badges: {
          select: { badge: { select: { name: true, iconUrl: true } } },
        },
      },
    }),
    prisma.taskAssignment.findMany({
      where: {
        OR: [{ status: TaskStatus.COMPLETED }, { score: { not: null } }],
      },
      select: { userId: true, taskId: true, status: true, score: true },
    }),
    prisma.taskSubmission.findMany({
      where: { score: { not: null } },
      select: {
        userId: true,
        taskId: true,
        status: true,
        score: true,
      },
      orderBy: { submittedAt: "asc" }, // later (re-graded) submissions win
    }),
  ]);

  // one entry per (user, task)
  const perTask = new Map<
    string,
    { userId: string; score: number; completed: boolean }
  >();

  for (const s of submissions) {
    if (s.status === SubmissionStatus.REJECTED) continue;
    perTask.set(`${s.userId}|${s.taskId}`, {
      userId: s.userId,
      score: s.score ?? 0,
      completed: s.status === SubmissionStatus.ACCEPTED,
    });
  }

  for (const a of assignments) {
    const key = `${a.userId}|${a.taskId}`;
    const fromSubmission = perTask.get(key);
    perTask.set(key, {
      userId: a.userId,
      score: a.score ?? fromSubmission?.score ?? 0,
      completed:
        a.status === TaskStatus.COMPLETED || fromSubmission?.completed === true,
    });
  }

  const totals = new Map<string, { totalScore: number; completedTasks: number }>();
  for (const t of perTask.values()) {
    const row = totals.get(t.userId) ?? { totalScore: 0, completedTasks: 0 };
    row.totalScore += t.score;
    if (t.completed) row.completedTasks += 1;
    totals.set(t.userId, row);
  }

  return users
    .map((user) => {
      const total = totals.get(user.id) ?? { totalScore: 0, completedTasks: 0 };
      return {
        id: user.id,
        name: user.name,
        profilePicture: user.profilePicture,
        group: user.group,
        semester: user.semester,
        completedTasks: total.completedTasks,
        totalScore: total.totalScore,
        badges: user.badges.map((b) => b.badge),
      };
    })
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        b.completedTasks - a.completedTasks ||
        a.name.localeCompare(b.name),
    )
    .slice(0, take);
};

const getProjectStats = async () => {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      sector: { select: { id: true, name: true } },
      _count: {
        select: {
          members: true,
          tasks: true,
          chatMessages: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return projects;
};

const getSectorStats = async () => {
  const sectors = await prisma.sector.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      icon: true,
      _count: {
        select: {
          members: true,
          projects: true,
          tasks: true,
          tests: true,
        },
      },
    },
    orderBy: { order: "asc" },
  });

  return sectors;
};

const getMonthlyGrowth = async () => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const users = await prisma.user.findMany({
    where: {
      createdAt: { gte: sixMonthsAgo },
    },
    select: {
      createdAt: true,
    },
  });

  const monthlyData: Record<string, number> = {};

  users.forEach((user) => {
    const month = user.createdAt.toISOString().slice(0, 7); // YYYY-MM
    monthlyData[month] = (monthlyData[month] || 0) + 1;
  });

  return monthlyData;
};

export const AnalyticsService = {
  getDashboardStats,
  getRecentActivities,
  getUserLeaderboard,
  getProjectStats,
  getSectorStats,        // ← new
  getMonthlyGrowth,
};