import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import validateRequest from "../../middlewares/validateRequest.js";
import { AuthValidation } from "./auth.validation.js";
import { AuthController } from "./auth.controller.js";
import auth from "../../middlewares/auth.middleware.js";

const ALL_ROLES = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER];

export default async function authRoutes(fastify: FastifyInstance) {
  // Public
  fastify.post(
    "/login",
    { preHandler: [validateRequest(AuthValidation.login)] },
    AuthController.loginUser
  );

  fastify.post("/refresh-token", AuthController.refreshToken);

  fastify.post("/logout", AuthController.logout);

  // Protected
  fastify.post(
    "/change-password",
    {
      preHandler: [
        auth(...ALL_ROLES),
        validateRequest(AuthValidation.changePassword),
      ],
    },
    AuthController.changePassword
  );

  fastify.get(
    "/me",
    { preHandler: [auth(...ALL_ROLES)] },
    AuthController.getMe
  );
}