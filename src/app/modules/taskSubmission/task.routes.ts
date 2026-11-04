import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { TaskSubmissionController } from "./task.submission.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { TaskSubmissionValidation } from "./task.submission.validation.js";

export default async function taskSubmissionRoutes(fastify: FastifyInstance) {
  const anyRole = auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER);
  const staff = auth(UserRole.ADMIN, UserRole.MODERATOR);


  // ── Single submission ───────────────────────────────────
  fastify.get(
    "/submissions/my",
    { preHandler: [anyRole] },
    TaskSubmissionController.getMySubmissions
  );

  fastify.get(
    "/submissions/:submissionId",
    { preHandler: [anyRole] },
    TaskSubmissionController.getSingleSubmission
  );

  fastify.patch(
    "/submissions/:submissionId",
    {
      preHandler: [
        anyRole,
        validateRequest(TaskSubmissionValidation.updateSchema),
      ],
    },
    TaskSubmissionController.updateSubmission
  );

  fastify.patch(
    "/submissions/:submissionId/review",
    {
      preHandler: [
        staff,
        validateRequest(TaskSubmissionValidation.reviewSchema),
      ],
    },
    TaskSubmissionController.reviewSubmission
  );

  fastify.delete(
    "/submissions/:submissionId",
    { preHandler: [anyRole] },
    TaskSubmissionController.deleteSubmission
  );

  // ── Submissions of one task ─────────────────────────────
  fastify.post(
    "/:id/submissions",
    {
      preHandler: [
        anyRole,
        validateRequest(TaskSubmissionValidation.submitSchema),
      ],
    },
    TaskSubmissionController.submitTask
  );

  fastify.get(
    "/:id/submissions",
    { preHandler: [staff] },
    TaskSubmissionController.getTaskSubmissions
  );

  fastify.get(
    "/:id/submissions/summary",
    { preHandler: [staff] },
    TaskSubmissionController.getSubmissionSummary
  );
}