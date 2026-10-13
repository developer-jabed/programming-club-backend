import { prisma } from "../../shared/prisma.js";
import {
  UserRole,
  UserStatus,
  ProjectStatus,
  TaskStatus,
  TestStatus,
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
  const [recentProjects, recentTasks, recentSubmissions, recentUsers] =
    await Promise.all([
      prisma.project.findMany({
        take: limit,
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
        take: limit,
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
        take: limit,
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
        take: limit,
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

const getUserLeaderboard = async (limit = 10) => {
  const users = await prisma.user.findMany({
    where: { role: UserRole.MEMBER, status: UserStatus.ACTIVE },
    select: {
      id: true,
      name: true,
      profilePicture: true,
      group: true,
      semester: true,
      taskAssignments: {
        where: { status: "COMPLETED" },
        select: { id: true, score: true },
      },
      badges: {
        select: { badge: { select: { name: true, iconUrl: true } } },
      },
    },
  });

  const leaderboard = users
    .map((user) => {
      const completedTasks = user.taskAssignments.length;
      const totalScore = user.taskAssignments.reduce(
        (sum, t) => sum + (t.score || 0),
        0
      );

      return {
        id: user.id,
        name: user.name,
        profilePicture: user.profilePicture,
        group: user.group,
        semester: user.semester,
        completedTasks,
        totalScore,
        badges: user.badges.map((b) => b.badge),
      };
    })
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore || b.completedTasks - a.completedTasks
    )
    .slice(0, limit);

  return leaderboard;
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