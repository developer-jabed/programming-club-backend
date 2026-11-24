import {
  NotificationType,
  Prisma,
  TestStatus,
  TestTargetType,
  AttemptStatus,
  QuestionType,
} from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";
import { prisma } from "../../shared/prisma.js";
import { NotificationService } from "../notification/notification.service.js";
import type {
  ICreateTest,
  ITestFilter,
  IUpdateTest,
  ISubmitAttempt,
} from "./test.interface.js";

const TestSearchableFields = ["title", "description"];

// ─── Notification Types ───────────────────────────────────────────
const TEST_ASSIGNED = NotificationType.TEST_ASSIGNED;
const TEST_RESULT = NotificationType.TEST_RESULT;

// ─── Create ───────────────────────────────────────────────────────

const createTest = async (userId: string, payload: ICreateTest) => {
  const { questions, memberIds = [], groups = [], sectorId, ...testData } = payload;

  return prisma.$transaction(async (tx) => {
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

    const test = await tx.test.create({
      data: {
        ...testData,
        createdById: userId,
        sectorId: sectorId || null,
        status: TestStatus.DRAFT,
        totalMarks,
      },
    });

    // Create questions + options
    for (const [index, q] of questions.entries()) {
      const question = await tx.question.create({
        data: {
          testId: test.id,
          questionText: q.questionText,
          type: q.type || QuestionType.SINGLE_CHOICE,
          marks: q.marks || 1,
          explanation: q.explanation,
          order: index,
        },
      });

      await tx.questionOption.createMany({
        data: q.options.map((opt, i) => ({
          questionId: question.id,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
          order: i,
        })),
      });
    }

    // 1. Specific Members
    if (payload.targetType === TestTargetType.SPECIFIC_MEMBERS && memberIds.length > 0) {
      await tx.testAssignment.createMany({
        data: memberIds.map((id) => ({
          testId: test.id,
          userId: id,
        })),
        skipDuplicates: true,
      });
    }

    // 2. Specific Groups
    if (payload.targetType === TestTargetType.SPECIFIC_GROUPS && groups.length > 0) {
      await tx.testTargetGroup.createMany({
        data: groups.map((g) => ({
          testId: test.id,
          groupName: g,
        })),
        skipDuplicates: true,
      });

      const members = await tx.user.findMany({
        where: {
          group: { in: groups },
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (members.length > 0) {
        await tx.testAssignment.createMany({
          data: members.map((m) => ({
            testId: test.id,
            userId: m.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 3. All Members
    if (payload.targetType === TestTargetType.ALL_MEMBERS) {
      const allMembers = await tx.user.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
      });

      if (allMembers.length > 0) {
        await tx.testAssignment.createMany({
          data: allMembers.map((m) => ({
            testId: test.id,
            userId: m.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 4. Sector Members
    if (payload.targetType === TestTargetType.SECTOR_MEMBERS && sectorId) {
      const sectorMembers = await tx.sectorMember.findMany({
        where: { sectorId },
        select: { userId: true },
      });

      if (sectorMembers.length > 0) {
        await tx.testAssignment.createMany({
          data: sectorMembers.map((m) => ({
            testId: test.id,
            userId: m.userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // 5. Project Members
    if (payload.targetType === TestTargetType.PROJECT_MEMBERS && payload.projectId) {
      const projectMembers = await tx.projectMember.findMany({
        where: {
          projectId: payload.projectId,
          status: "ACTIVE",
        },
        select: { userId: true },
      });

      if (projectMembers.length > 0) {
        await tx.testAssignment.createMany({
          data: projectMembers.map((m) => ({
            testId: test.id,
            userId: m.userId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return tx.test.findUnique({
      where: { id: test.id },
      include: {
        createdBy: {
          select: { id: true, name: true, profilePicture: true },
        },
        project: {
          select: { id: true, title: true },
        },
        sector: {
          select: { id: true, name: true, slug: true },
        },
        questions: {
          include: { options: true },
          orderBy: { order: "asc" },
        },
        _count: {
          select: { assignments: true },
        },
      },
    });
  });
};

// ─── Get All ──────────────────────────────────────────────────────

const getAllTests = async (filters: ITestFilter, query: PaginationQuery) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.TestWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: TestSearchableFields.map((field) => ({
        [field]: { contains: searchTerm, mode: "insensitive" },
      })),
    });
  }

  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([key, value]) => ({
        [key]: { equals: value },
      })),
    });
  }

  const where: Prisma.TestWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [data, total] = await Promise.all([
    prisma.test.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        createdBy: { select: { id: true, name: true, profilePicture: true } },
        project: { select: { id: true, title: true } },
        _count: {
          select: {
            questions: true,
            assignments: true,
            attempts: true,
          },
        },
      },
    }),
    prisma.test.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

// ─── Get Single ───────────────────────────────────────────────────

const getSingleTest = async (id: string, userId?: string) => {
  const test = await prisma.test.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, profilePicture: true } },
      project: { select: { id: true, title: true } },
      questions: {
        include: {
          options: {
            select: {
              id: true,
              optionText: true,
              order: true,
              // hide isCorrect for students
            },
          },
        },
        orderBy: { order: "asc" },
      },
      _count: { select: { assignments: true, attempts: true } },
    },
  });

  if (!test) throw new ApiError(httpStatus.NOT_FOUND, "Test not found");
  return test;
};

// ─── Update ───────────────────────────────────────────────────────

const updateTest = async (id: string, userId: string, payload: IUpdateTest) => {
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) throw new ApiError(httpStatus.NOT_FOUND, "Test not found");
  if (test.createdById !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the creator can update this test");
  }

  return prisma.test.update({
    where: { id },
    data: payload,
  });
};

// ─── Publish ──────────────────────────────────────────────────────

const publishTest = async (id: string, userId: string) => {
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) throw new ApiError(httpStatus.NOT_FOUND, "Test not found");
  if (test.createdById !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the creator can publish this test");
  }

  const published = await prisma.test.update({
    where: { id },
    data: { status: TestStatus.PUBLISHED },
  });

  // Notify assignees only on the first publish
  if (test.status !== TestStatus.PUBLISHED) {
    const assignments = await prisma.testAssignment.findMany({
      where: { testId: id },
      select: { userId: true },
    });

    const targetIds = assignments
      .map((a) => a.userId)
      .filter((uid) => uid !== userId);

    await NotificationService.notifyManySafe(
      targetIds,
      {
        type: TEST_ASSIGNED,
        title: "New test assigned",
        body: `"${published.title}" is now available. You can start whenever you're ready.`,
        entityType: "Test",
        entityId: id,
        metadata: {
          testTitle: published.title,
          action: "start_test",
        },
      },
      "testAssigned"
    );
  }

  return published;
};

// ─── Delete ───────────────────────────────────────────────────────

const deleteTest = async (id: string, userId: string) => {
  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) throw new ApiError(httpStatus.NOT_FOUND, "Test not found");
  if (test.createdById !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, "Only the creator can delete this test");
  }

  return prisma.test.delete({ where: { id } });
};

// ─── Start Attempt ────────────────────────────────────────────────

const startAttempt = async (testId: string, userId: string) => {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { questions: true },
  });

  if (!test) throw new ApiError(httpStatus.NOT_FOUND, "Test not found");
  if (test.status !== TestStatus.PUBLISHED) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Test is not published yet");
  }

  const existing = await prisma.testAttempt.findUnique({
    where: { testId_userId: { testId, userId } },
  });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "You have already attempted this test");
  }

  const attempt = await prisma.testAttempt.create({
    data: {
      testId,
      userId,
      status: AttemptStatus.IN_PROGRESS,
    },
  });

  return attempt;
};

// ─── Submit Attempt ───────────────────────────────────────────────

const submitAttempt = async (
  testId: string,
  userId: string,
  payload: ISubmitAttempt
) => {
  const attempt = await prisma.testAttempt.findUnique({
    where: { testId_userId: { testId, userId } },
  });

  if (!attempt) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "Attempt not found. Please start the test first."
    );
  }

  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "This attempt has already been submitted"
    );
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: {
        include: { options: true },
      },
    },
  });

  if (!test) throw new ApiError(httpStatus.NOT_FOUND, "Test not found");

  let totalScore = 0;

  // Grade answers
  for (const answer of payload.answers) {
    const question = test.questions.find((q) => q.id === answer.questionId);
    if (!question) continue;

    const correctOptionIds = question.options
      .filter((o) => o.isCorrect)
      .map((o) => o.id)
      .sort();

    const selected = [...answer.selectedOptionIds].sort();

    const isCorrect =
      correctOptionIds.length === selected.length &&
      correctOptionIds.every((id, i) => id === selected[i]);

    const marksObtained = isCorrect ? question.marks : 0;
    totalScore += marksObtained;

    await prisma.testAnswer.create({
      data: {
        attemptId: attempt.id,
        questionId: question.id,
        selectedOptions: answer.selectedOptionIds,
        isCorrect,
        marksObtained,
      },
    });
  }

  const percentage =
    test.totalMarks > 0
      ? Math.round((totalScore / test.totalMarks) * 1000) / 10
      : 0;

  const updatedAttempt = await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      status: AttemptStatus.SUBMITTED,
      score: totalScore,
      percentage,
      submittedAt: new Date(),
      timeTakenSec: Math.floor(
        (Date.now() - attempt.startedAt.getTime()) / 1000
      ),
    },
    include: {
      answers: {
        include: {
          question: {
            select: {
              id: true,
              questionText: true,
              marks: true,
              explanation: true,
            },
          },
        },
      },
    },
  });

  // ────────────────────────────────────────────────
  // 1. Notify the student about their result
  // ────────────────────────────────────────────────
  try {
    const passed = test.passingMarks
      ? totalScore >= test.passingMarks
      : percentage >= 50;

    let title: string;
    let body: string;

    if (percentage >= 90) {
      title = "Excellent result";
      body = `You scored ${totalScore}/${test.totalMarks} (${percentage}%) on "${test.title}". Outstanding work.`;
    } else if (passed) {
      title = "You passed";
      body = `You scored ${totalScore}/${test.totalMarks} (${percentage}%) on "${test.title}". Well done.`;
    } else {
      title = "Result available";
      body = `You scored ${totalScore}/${test.totalMarks} (${percentage}%) on "${test.title}". Review the answers and try again when ready.`;
    }

    await NotificationService.notifySafe(
      {
        userId,
        type: TEST_RESULT,
        title,
        body,
        entityType: "Test",
        entityId: testId,
        metadata: {
          score: totalScore,
          totalMarks: test.totalMarks,
          percentage,
          passed,
          action: "view_result",
        },
      },
      "testAssigned"
    );
  } catch (error) {
    console.error("[TestService.submitAttempt - student notify]", error);
  }

  // ────────────────────────────────────────────────
  // 2. Notify the test creator
  // ────────────────────────────────────────────────
  if (test.createdById !== userId) {
    try {
      const student = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });

      await NotificationService.notifySafe({
        userId: test.createdById,
        type: NotificationType.SUBMISSION_REVIEWED,
        title: "New submission received",
        body: `${student?.name ?? "A member"} submitted "${test.title}" — ${totalScore}/${test.totalMarks} (${percentage}%)`,
        entityType: "Test",
        entityId: testId,
        metadata: {
          studentId: userId,
          studentName: student?.name,
          score: totalScore,
          totalMarks: test.totalMarks,
          percentage,
          action: "view_submission",
        },
      });
    } catch (error) {
      console.error("[TestService.submitAttempt - creator notify]", error);
    }
  }

  return updatedAttempt;
};

// ─── Get My Attempt ───────────────────────────────────────────────

const getMyAttempt = async (testId: string, userId: string) => {
  const attempt = await prisma.testAttempt.findUnique({
    where: { testId_userId: { testId, userId } },
    include: {
      answers: {
        include: {
          question: {
            include: { options: true },
          },
        },
      },
      test: {
        select: {
          title: true,
          totalMarks: true,
          passingMarks: true,
          showResultImmediately: true,
        },
      },
    },
  });

  if (!attempt) {
    throw new ApiError(httpStatus.NOT_FOUND, "Attempt not found");
  }

  return attempt;
};

// ─── Export ───────────────────────────────────────────────────────

export const TestService = {
  createTest,
  getAllTests,
  getSingleTest,
  updateTest,
  publishTest,
  deleteTest,
  startAttempt,
  submitAttempt,
  getMyAttempt,
};