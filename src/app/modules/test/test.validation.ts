import { z } from "zod";
import { TestStatus, TestTargetType, QuestionType } from "@prisma/client";

const optionSchema = z.object({
  optionText: z.string().min(1),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  questionText: z.string().min(5),
  type: z.nativeEnum(QuestionType).optional(),
  marks: z.number().int().positive().optional(),
  explanation: z.string().optional(),
  options: z.array(optionSchema).min(2),
});

export const createTestSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    passingMarks: z.number().int().nonnegative().optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    shuffleQuestions: z.boolean().optional(),
    showResultImmediately: z.boolean().optional(),
    projectId: z.string().optional(),
    targetType: z.nativeEnum(TestTargetType),
    memberIds: z.array(z.string()).optional(),
    groups: z.array(z.string()).optional(),
    questions: z.array(questionSchema).min(1),
  }),
});

export const updateTestSchema = z.object({
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    passingMarks: z.number().int().nonnegative().optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    shuffleQuestions: z.boolean().optional(),
    showResultImmediately: z.boolean().optional(),
    status: z.nativeEnum(TestStatus).optional(),
  }),
});

export const submitAttemptSchema = z.object({
  body: z.object({
    answers: z.array(
      z.object({
        questionId: z.string(),
        selectedOptionIds: z.array(z.string()).min(1),
      })
    ),
  }),
});

export const TestValidation = {
  createTestSchema,
  updateTestSchema,
  submitAttemptSchema,
};