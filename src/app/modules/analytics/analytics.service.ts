import { prisma } from "../../shared/prisma.js";
import {
  UserRole,
  UserStatus,
  ProjectStatus,
  TaskStatus,
  TestStatus,
  SubmissionStatus,
  AttemptStatus,
  ProjectMemberStatus,
  Prisma,
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
 * Legacy leaderboard (task marks only). Kept for backward compatibility.
 * New code should use getLeaderboard() below.
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

/* ══════════════════════════════════════════════════════════════
 * Leaderboard v2
 *
 * Points come from ALL member activity, weighted by how much each
 * kind of work should matter:
 *
 *   projects  BIGGEST  reviewer's mark on project submissions
 *                      (+ small bonus when accepted), owning / joining
 *   tasks     medium   task marks × small factor + small completion bonus
 *   tests     small    test % × small factor + small pass bonus
 *   chat      tiny     a fraction of a point per message, capped per day
 *   badges    small    flat bonus per badge earned
 *
 * Every period (except all_time) is compared with the immediately
 * preceding window of the same length, which gives rank movement,
 * points change and "rising stars".
 *
 * Example (all values with the defaults below):
 *   project submission marked 80, accepted → 80 + 10 = 90
 *   task marked 80, completed              → 24 + 2  = 26
 *   test 90%, passed                       →  9 + 2  = 11
 *   a very chatty day (5+ messages)        →  1
 * ══════════════════════════════════════════════════════════════ */

export const LEADERBOARD_PERIODS = [
  "7d",
  "30d",
  "90d",
  "this_month",
  "last_month",
  "all_time",
] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export const SCORING = {
  // ── projects: the main source of points ──
  // The reviewer's mark counts × this factor. Assumes marks around 0-100;
  // if your reviewers mark out of 10, set this to 10.
  projectSubmissionScoreFactor: 1,
  projectSubmissionAccepted: 10, // bonus when a submission is accepted
  projectOwned: 10,
  projectJoined: 3,

  // ── tasks: lower ──
  taskScoreFactor: 0.3, // task mark × 0.3
  taskCompleted: 2, // small bonus per completed task

  // ── tests: lower ──
  testPercentFactor: 0.1, // 100% in a test = 10 pts
  testPassBonus: 2,

  // ── chat: lowest ──
  messagePoint: 0.2, // 5 messages = 1 pt
  dailyChatPointCap: 1, // max chat points per member per day

  // ── badges ──
  badgeEarned: 5,
} as const;

const TZ_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka (UTC+6)
const DAY_MS = 86_400_000;

type Kind = "tasks" | "tests" | "chat" | "projects" | "badges";

interface Range {
  from: Date | null;
  to: Date;
}

interface Ev {
  userId: string;
  at: number;
  kind: Kind;
  points: number;
  completed?: boolean; // task completed
  percent?: number; // test percentage
}

interface Agg {
  points: number;
  breakdown: Record<Kind, number>;
  tasksCompleted: number;
  testsTaken: number;
  testPercentSum: number;
  messages: number;
  projects: number;
  badgesEarned: number;
  days: Set<string>;
}

const emptyAgg = (): Agg => ({
  points: 0,
  breakdown: { tasks: 0, tests: 0, chat: 0, projects: 0, badges: 0 },
  tasksCompleted: 0,
  testsTaken: 0,
  testPercentSum: 0,
  messages: 0,
  projects: 0,
  badgesEarned: 0,
  days: new Set(),
});

const dayKey = (t: number) =>
  new Date(t + TZ_OFFSET_MS).toISOString().slice(0, 10);

const monthStart = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 1) - TZ_OFFSET_MS);

const isPeriod = (v: unknown): v is LeaderboardPeriod =>
  typeof v === "string" && (LEADERBOARD_PERIODS as readonly string[]).includes(v);

function resolveRanges(period: LeaderboardPeriod, now = new Date()) {
  const local = new Date(now.getTime() + TZ_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();

  const rolling = (days: number) => {
    const from = new Date(now.getTime() - days * DAY_MS);
    return {
      current: { from, to: now } as Range,
      previous: {
        from: new Date(from.getTime() - days * DAY_MS),
        to: new Date(from.getTime() - 1),
      } as Range,
    };
  };

  switch (period) {
    case "7d":
      return rolling(7);
    case "30d":
      return rolling(30);
    case "90d":
      return rolling(90);
    case "this_month": {
      const from = monthStart(y, m);
      const span = now.getTime() - from.getTime();
      return {
        current: { from, to: now } as Range,
        previous: {
          from: new Date(from.getTime() - span),
          to: new Date(from.getTime() - 1),
        } as Range,
      };
    }
    case "last_month": {
      const from = monthStart(y, m - 1);
      const end = monthStart(y, m);
      return {
        current: { from, to: new Date(end.getTime() - 1) } as Range,
        previous: {
          from: monthStart(y, m - 2),
          to: new Date(from.getTime() - 1),
        } as Range,
      };
    }
    default:
      return {
        current: { from: null, to: now } as Range,
        previous: null as Range | null,
      };
  }
}

const inRange = (t: number, r: Range) =>
  (r.from === null || t >= r.from.getTime()) && t <= r.to.getTime();

function aggregate(events: Ev[], range: Range): Map<string, Agg> {
  const out = new Map<string, Agg>();
  const chatPointsPerDay = new Map<string, number>();

  for (const e of events) {
    if (!inRange(e.at, range)) continue;

    let a = out.get(e.userId);
    if (!a) {
      a = emptyAgg();
      out.set(e.userId, a);
    }

    let pts = e.points;
    const day = dayKey(e.at);

    switch (e.kind) {
      case "tasks":
        if (e.completed) a.tasksCompleted += 1;
        break;
      case "tests":
        a.testsTaken += 1;
        a.testPercentSum += e.percent ?? 0;
        break;
      case "chat": {
        a.messages += 1;
        // chat points are capped per member per day
        const k = `${e.userId}|${day}`;
        const used = chatPointsPerDay.get(k) ?? 0;
        pts = Math.max(0, Math.min(e.points, SCORING.dailyChatPointCap - used));
        chatPointsPerDay.set(k, used + pts);
        break;
      }
      case "projects":
        a.projects += 1;
        break;
      case "badges":
        a.badgesEarned += 1;
        break;
    }

    a.points += pts;
    a.breakdown[e.kind] += pts;
    a.days.add(day);
  }

  // points can be fractional while adding up; show and rank whole numbers
  for (const a of out.values()) {
    (Object.keys(a.breakdown) as Kind[]).forEach((k) => {
      a.breakdown[k] = Math.round(a.breakdown[k]);
    });
    a.points = Object.values(a.breakdown).reduce((sum, v) => sum + v, 0);
  }

  return out;
}

function rankAggs(aggs: Map<string, Agg>, names: Map<string, string>) {
  const rows = [...aggs.entries()]
    .filter(([, a]) => a.points > 0)
    .map(([id, a]) => ({ id, a, name: names.get(id) ?? "" }))
    .sort(
      (x, y) =>
        y.a.points - x.a.points ||
        y.a.tasksCompleted - x.a.tasksCompleted ||
        x.name.localeCompare(y.name),
    );

  const ranks = new Map<string, number>();
  let lastPts = -1;
  let lastRank = 0;
  rows.forEach((r, i) => {
    const rk = r.a.points === lastPts ? lastRank : i + 1; // 1,2,2,4
    ranks.set(r.id, rk);
    lastPts = r.a.points;
    lastRank = rk;
  });

  return { rows, ranks };
}

export interface LeaderboardOptions {
  period?: string;
  limit?: number | string;
  offset?: number | string;
  group?: string;
  semester?: number | string;
  userId?: string; // the viewer, to return their own position
}

function emptyLeaderboard(
  period: LeaderboardPeriod,
  current: Range,
  previous: Range | null,
) {
  return {
    period,
    range: {
      from: current.from?.toISOString() ?? null,
      to: current.to.toISOString(),
    },
    comparedWith: previous
      ? {
          from: previous.from?.toISOString() ?? null,
          to: previous.to.toISOString(),
        }
      : null,
    scoring: SCORING,
    summary: {
      members: 0,
      participants: 0,
      totalPoints: 0,
      averagePoints: 0,
      topScore: 0,
    },
    pagination: { total: 0, limit: 0, offset: 0, hasMore: false },
    entries: [] as never[],
    risingStars: [] as never[],
    me: null,
  };
}

const getLeaderboard = async (opts: LeaderboardOptions = {}) => {
  const period: LeaderboardPeriod = isPeriod(opts.period) ? opts.period : "30d";
  const limit = Math.min(Math.max(Math.trunc(Number(opts.limit)) || 25, 1), 100);
  const offset = Math.max(Math.trunc(Number(opts.offset)) || 0, 0);
  const semester = Math.trunc(Number(opts.semester)) || undefined;

  const { current, previous } = resolveRanges(period);
  const lower = previous?.from ?? current.from; // null → all_time
  const since = lower ? { gte: lower } : undefined;

  const userWhere: Prisma.UserWhereInput = {
    role: UserRole.MEMBER,
    status: UserStatus.ACTIVE,
    ...(opts.group ? { group: opts.group } : {}),
    ...(semester ? { semester } : {}),
  };

  const users = await prisma.user.findMany({
    where: userWhere,
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
  });

  const ids = users.map((u) => u.id);
  if (ids.length === 0) {
    return emptyLeaderboard(period, current, previous);
  }

  const [
    assignments,
    submissions,
    attempts,
    messages,
    owned,
    memberships,
    projectSubs,
    userBadges,
  ] = await Promise.all([
    prisma.taskAssignment.findMany({
      where: {
        userId: { in: ids },
        OR: [{ status: TaskStatus.COMPLETED }, { score: { not: null } }],
      },
      select: {
        userId: true,
        taskId: true,
        status: true,
        score: true,
        assignedAt: true,
        completedAt: true,
      },
    }),
    prisma.taskSubmission.findMany({
      where: {
        userId: { in: ids },
        status: { not: SubmissionStatus.REJECTED },
        OR: [{ score: { not: null } }, { status: SubmissionStatus.ACCEPTED }],
      },
      select: {
        userId: true,
        taskId: true,
        status: true,
        score: true,
        submittedAt: true,
        reviewedAt: true,
      },
      orderBy: { submittedAt: "asc" }, // later (re-graded) submissions win
    }),
    prisma.testAttempt.findMany({
      where: {
        userId: { in: ids },
        status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
        percentage: { not: null },
      },
      select: {
        userId: true,
        percentage: true,
        score: true,
        submittedAt: true,
        startedAt: true,
        test: { select: { passingMarks: true } },
      },
    }),
    prisma.chatMessage.findMany({
      where: {
        senderId: { in: ids },
        isSystem: false,
        deletedAt: null,
        ...(since ? { createdAt: since } : {}),
      },
      select: { senderId: true, createdAt: true },
    }),
    prisma.project.findMany({
      where: { ownerId: { in: ids }, ...(since ? { createdAt: since } : {}) },
      select: { ownerId: true, createdAt: true },
    }),
    prisma.projectMember.findMany({
      where: {
        userId: { in: ids },
        status: ProjectMemberStatus.ACTIVE,
        joinedAt: since ?? { not: null },
      },
      select: {
        userId: true,
        joinedAt: true,
        project: { select: { ownerId: true } },
      },
    }),
    prisma.projectSubmission.findMany({
      where: {
        submittedById: { in: ids },
        status: { not: SubmissionStatus.REJECTED },
        // a reviewer's mark, or an accepted submission
        OR: [{ score: { not: null } }, { status: SubmissionStatus.ACCEPTED }],
      },
      select: {
        projectId: true,
        submittedById: true,
        status: true,
        score: true,
        submittedAt: true,
        reviewedAt: true,
      },
      orderBy: { submittedAt: "asc" }, // later (re-graded) submissions win
    }),
    prisma.userBadge.findMany({
      where: { userId: { in: ids }, ...(since ? { earnedAt: since } : {}) },
      select: { userId: true, earnedAt: true },
    }),
  ]);

  /* ── turn every source into dated point events ── */
  const events: Ev[] = [];

  // tasks: ONE mark per (user, task): assignment score → else submission score
  const perTask = new Map<
    string,
    {
      userId: string;
      score: number | null;
      completed: boolean;
      at: number;
    }
  >();

  for (const s of submissions) {
    perTask.set(`${s.userId}|${s.taskId}`, {
      userId: s.userId,
      score: s.score,
      completed: s.status === SubmissionStatus.ACCEPTED,
      at: (s.reviewedAt ?? s.submittedAt).getTime(),
    });
  }
  for (const a of assignments) {
    const key = `${a.userId}|${a.taskId}`;
    const sub = perTask.get(key);
    const assignmentCounts =
      a.score !== null || a.status === TaskStatus.COMPLETED;
    perTask.set(key, {
      userId: a.userId,
      score: a.score ?? sub?.score ?? null,
      completed: a.status === TaskStatus.COMPLETED || sub?.completed === true,
      at: assignmentCounts
        ? (a.completedAt ?? a.assignedAt).getTime()
        : (sub?.at ?? a.assignedAt.getTime()),
    });
  }
  for (const t of perTask.values()) {
    if (t.score === null && !t.completed) continue;
    events.push({
      userId: t.userId,
      at: t.at,
      kind: "tasks",
      completed: t.completed,
      points:
        (t.score ?? 0) * SCORING.taskScoreFactor +
        (t.completed ? SCORING.taskCompleted : 0),
    });
  }

  // tests
  for (const at of attempts) {
    const pct = at.percentage ?? 0;
    const passed =
      at.test.passingMarks !== null && at.score !== null
        ? at.score >= at.test.passingMarks
        : pct >= 50;
    events.push({
      userId: at.userId,
      at: (at.submittedAt ?? at.startedAt).getTime(),
      kind: "tests",
      percent: pct,
      points:
        pct * SCORING.testPercentFactor + (passed ? SCORING.testPassBonus : 0),
    });
  }

  // chat
  for (const m of messages) {
    events.push({
      userId: m.senderId,
      at: m.createdAt.getTime(),
      kind: "chat",
      points: SCORING.messagePoint,
    });
  }

  // projects: owning / joining
  for (const p of owned) {
    events.push({
      userId: p.ownerId,
      at: p.createdAt.getTime(),
      kind: "projects",
      points: SCORING.projectOwned,
    });
  }
  for (const pm of memberships) {
    if (!pm.joinedAt || pm.project.ownerId === pm.userId) continue; // owner counted above
    events.push({
      userId: pm.userId,
      at: pm.joinedAt.getTime(),
      kind: "projects",
      points: SCORING.projectJoined,
    });
  }

  // projects: the reviewer's mark on a submission (the biggest source).
  // ONE entry per (project, member): the latest non-rejected submission wins.
  const perProjectSub = new Map<
    string,
    {
      userId: string;
      score: number | null;
      accepted: boolean;
      at: number;
    }
  >();
  for (const ps of projectSubs) {
    perProjectSub.set(`${ps.projectId}|${ps.submittedById}`, {
      userId: ps.submittedById,
      score: ps.score,
      accepted: ps.status === SubmissionStatus.ACCEPTED,
      at: (ps.reviewedAt ?? ps.submittedAt).getTime(),
    });
  }
  for (const ps of perProjectSub.values()) {
    events.push({
      userId: ps.userId,
      at: ps.at,
      kind: "projects",
      points:
        (ps.score ?? 0) * SCORING.projectSubmissionScoreFactor +
        (ps.accepted ? SCORING.projectSubmissionAccepted : 0),
    });
  }

  // badges
  for (const b of userBadges) {
    events.push({
      userId: b.userId,
      at: b.earnedAt.getTime(),
      kind: "badges",
      points: SCORING.badgeEarned,
    });
  }

  /* ── aggregate current + previous window ── */
  const names = new Map(users.map((u) => [u.id, u.name]));
  const curAgg = aggregate(events, current);
  const prevAgg = previous ? aggregate(events, previous) : null;

  const cur = rankAggs(curAgg, names);
  const prev = prevAgg ? rankAggs(prevAgg, names) : null;
  const userById = new Map(users.map((u) => [u.id, u]));

  const buildEntry = (id: string, agg: Agg, rank: number | null) => {
    const u = userById.get(id)!;
    const pAgg = prevAgg?.get(id);
    const prevPoints = pAgg?.points ?? 0;
    const prevRank = prev?.ranks.get(id) ?? null;
    return {
      rank,
      previousRank: prevRank,
      rankChange:
        prev && rank !== null && prevRank !== null ? prevRank - rank : null,
      isNew: Boolean(prev) && rank !== null && prevRank === null,
      id,
      name: u.name,
      profilePicture: u.profilePicture,
      group: u.group,
      semester: u.semester,
      points: agg.points,
      pointsChange: prev ? agg.points - prevPoints : null,
      percentChange:
        prev && prevPoints > 0
          ? Math.round(((agg.points - prevPoints) / prevPoints) * 100)
          : null,
      breakdown: agg.breakdown,
      stats: {
        tasksCompleted: agg.tasksCompleted,
        testsTaken: agg.testsTaken,
        avgTestPercent:
          agg.testsTaken > 0
            ? Math.round(agg.testPercentSum / agg.testsTaken)
            : null,
        messages: agg.messages,
        projects: agg.projects,
        badgesEarned: agg.badgesEarned,
        activeDays: agg.days.size,
      },
      badges: u.badges.map((b) => b.badge),
    };
  };

  const ranked = cur.rows.map((r) => buildEntry(r.id, r.a, cur.ranks.get(r.id)!));

  const risingStars = ranked
    .filter((e) => (e.pointsChange ?? 0) > 0)
    .sort(
      (a, b) =>
        (b.pointsChange ?? 0) - (a.pointsChange ?? 0) || b.points - a.points,
    )
    .slice(0, 5);

  // viewer's own position (even when outside the returned page)
  let me:
    | (ReturnType<typeof buildEntry> & { pointsToNext: number | null })
    | null = null;
  if (opts.userId && userById.has(opts.userId)) {
    const agg = curAgg.get(opts.userId) ?? emptyAgg();
    const entry = buildEntry(opts.userId, agg, cur.ranks.get(opts.userId) ?? null);
    const above = cur.rows.filter((r) => r.a.points > agg.points);
    const nearest = above[above.length - 1];
    me = {
      ...entry,
      pointsToNext: nearest ? nearest.a.points - agg.points : null,
    };
  }

  const totalPoints = ranked.reduce((sum, e) => sum + e.points, 0);

  return {
    period,
    range: {
      from: current.from?.toISOString() ?? null,
      to: current.to.toISOString(),
    },
    comparedWith: previous
      ? {
          from: previous.from?.toISOString() ?? null,
          to: previous.to.toISOString(),
        }
      : null,
    scoring: SCORING,
    summary: {
      members: users.length,
      participants: ranked.length,
      totalPoints,
      averagePoints: ranked.length ? Math.round(totalPoints / ranked.length) : 0,
      topScore: ranked[0]?.points ?? 0,
    },
    pagination: {
      total: ranked.length,
      limit,
      offset,
      hasMore: offset + limit < ranked.length,
    },
    entries: ranked.slice(offset, offset + limit),
    risingStars,
    me,
  };
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
  getUserLeaderboard, // legacy, task marks only
  getLeaderboard, // new: full-activity leaderboard
  getProjectStats,
  getSectorStats,
  getMonthlyGrowth,
};