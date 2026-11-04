import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { SubmissionController } from "./submission.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { SubmissionValidation } from "./submission.validation.js";

const ALL_ROLES = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER];

export default async function submissionRoutes(fastify: FastifyInstance) {
  // ── Task Submissions ─────────────────────────────────────
  fastify.post(
    "/tasks/:taskId",
    {
      preHandler: [
        auth(...ALL_ROLES),
        validateRequest(SubmissionValidation.createTaskSubmissionSchema),
      ],
    },
    SubmissionController.submitTask
  );

  fastify.get(
    "/tasks/:taskId",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)] },
    SubmissionController.getTaskSubmissions
  );

  fastify.patch(
    "/tasks/review/:submissionId",
    {
      preHandler: [
        auth(UserRole.ADMIN, UserRole.MODERATOR),
        validateRequest(SubmissionValidation.reviewSubmissionSchema),
      ],
    },
    SubmissionController.reviewTaskSubmission
  );

  // ── Project Submissions ──────────────────────────────────
  fastify.post(
    "/projects/:projectId",
    {
      preHandler: [
        auth(...ALL_ROLES),
        validateRequest(SubmissionValidation.createProjectSubmissionSchema),
      ],
    },
    SubmissionController.submitProject
  );

  fastify.patch(
    "/projects/review/:submissionId",
    {
      preHandler: [
        auth(...ALL_ROLES),
        validateRequest(SubmissionValidation.reviewSubmissionSchema),
      ],
    },
    SubmissionController.reviewProjectSubmission
  );
}