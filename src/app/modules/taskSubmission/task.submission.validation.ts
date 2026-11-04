import { z } from "zod";
import { SubmissionStatus } from "@prisma/client";

const submit = z.object({
  body: z
    .object({
      content: z.string().trim().max(5000).optional(),
      link: z.string().trim().url("Link must be a valid URL").optional(),
      fileUrls: z.array(z.string().url()).max(10).optional(),
    })
    .refine(
      (d) => !!d.content || !!d.link || (d.fileUrls?.length ?? 0) > 0,
      { message: "Provide content, a link, or at least one file" }
    ),
});

const update = z.object({
  body: z
    .object({
      content: z.string().trim().max(5000).nullable().optional(),
      link: z.string().trim().url("Link must be a valid URL").nullable().optional(),
      fileUrls: z.array(z.string().url()).max(10).optional(),
    })
    .refine((d) => Object.keys(d).length > 0, {
      message: "Nothing to update",
    }),
});

// "", null, NaN -> undefined (field omitted)
const emptyToUndefined = (v: unknown) => {
  if (v === "" || v === null) return undefined;
  if (typeof v === "number" && Number.isNaN(v)) return undefined;
  return v;
};

const review = z.object({
  body: z.object({
    status: z
      .nativeEnum(SubmissionStatus, {
        message: `Invalid status. Allowed: ${Object.values(SubmissionStatus).join(", ")}`,
      })
      .refine((s) => s !== SubmissionStatus.SUBMITTED, {
        message: "Choose a review status",
      }),
    score: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number({ message: "Score must be a number" })
        .int("Score must be a whole number")
        .min(0, "Score cannot be negative")
        .optional()
    ),
    feedback: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(2000, "Feedback is too long").optional()
    ),
  }),
});

export const TaskSubmissionValidation = {
  submitSchema: submit,
  updateSchema: update,
  reviewSchema: review,
};