import { z } from "zod";
import { SubmissionStatus } from "@prisma/client";

export const createTaskSubmissionSchema = z.object({
  body: z.object({
    content: z.string().optional(),
    link: z.string().url().optional(),
    fileUrls: z.array(z.string().url()).optional(),
  }),
});

export const reviewSubmissionSchema = z.object({
  body: z.object({
    status: z.enum(["ACCEPTED", "CHANGES_REQUESTED", "REJECTED"]),
    score: z.number().int().min(0).optional(),
    feedback: z.string().optional(),
  }),
});

export const createProjectSubmissionSchema = z.object({
  body: z.object({
    title: z.string().optional(),
    description: z.string().min(10),
    link: z.string().url(),
    extraLinks: z.array(z.string().url()).optional(),
  }),
});

export const SubmissionValidation = {
  createTaskSubmissionSchema,
  reviewSubmissionSchema,
  createProjectSubmissionSchema,
};