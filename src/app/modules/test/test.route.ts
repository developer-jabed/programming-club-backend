import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { TestController } from "./test.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { TestValidation } from "./test.validation.js";

export default async function testRoutes(fastify: FastifyInstance) {
  // Create Test
  fastify.post(
    "/",
    {
      preHandler: [
        auth(UserRole.ADMIN, UserRole.MODERATOR),
        validateRequest(TestValidation.createTestSchema),
      ],
    },
    TestController.createTest
  );

  // Get All Tests
  fastify.get(
    "/",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)] },
    TestController.getAllTests
  );

  // Get Single Test
  fastify.get(
    "/:id",
    { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)] },
    TestController.getSingleTest
  );

  // Update Test
  fastify.patch(
    "/:id",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    TestController.updateTest
  );

  // Publish Test
  fastify.patch(
    "/:id/publish",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    TestController.publishTest
  );

  // Delete Test
  fastify.delete(
    "/:id",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    TestController.deleteTest
  );

  // Start Attempt
  fastify.post(
    "/:id/start",
    {
      preHandler: [auth(UserRole.MEMBER, UserRole.MODERATOR, UserRole.ADMIN)],
    },
    TestController.startAttempt
  );

  // Submit Attempt
  fastify.post(
    "/:id/submit",
    {
      preHandler: [
        auth(UserRole.MEMBER, UserRole.MODERATOR, UserRole.ADMIN),
        validateRequest(TestValidation.submitAttemptSchema),
      ],
    },
    TestController.submitAttempt
  );

  // Get My Attempt Result
  fastify.get(
    "/:id/my-attempt",
    {
      preHandler: [auth(UserRole.MEMBER, UserRole.MODERATOR, UserRole.ADMIN)],
    },
    TestController.getMyAttempt
  );
}