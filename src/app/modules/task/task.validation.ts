import { z } from "zod";
import { TaskPriority, TaskStatus, TaskTargetType } from "@prisma/client";

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.string().datetime().optional(),
    maxScore: z.number().int().positive().optional(),
    projectId: z.string().optional(),
    targetType: z.nativeEnum(TaskTargetType),
    memberIds: z.array(z.string()).optional(),
    groups: z.array(z.string()).optional(),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    dueDate: z.string().datetime().optional(),
    maxScore: z.number().int().positive().optional(),
  }),
});

export const TaskValidation = {
  createTaskSchema,
  updateTaskSchema,
};