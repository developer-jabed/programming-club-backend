import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { UserController } from "./user.controller.js";
import { UserValidation } from "./user.validation.js";
import validateRequest from "../../middlewares/validateRequest.js";
import auth from "../../middlewares/auth.middleware.js";

export default async function userRoutes(fastify: FastifyInstance) {
  // Create User → Only Admin & Moderator
  fastify.post(
    "/",
    {
      preHandler: [
        auth(UserRole.ADMIN, UserRole.MODERATOR),
        // validateRequest(UserValidation.createUserSchema), // enable if you want
      ],
    },
    UserController.createUser
  );

  // Get All Users → Only Admin & Moderator
  fastify.get(
    "/",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    UserController.getAllUsers
  );

  // Get Single User → All authenticated users
  fastify.get(
    "/:id",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)],
    },
    UserController.getSingleUser
  );

  // Update User → Only Admin & Moderator
  fastify.patch(
    "/:id",
    {
      preHandler: [
        auth(UserRole.ADMIN, UserRole.MODERATOR),
        // validateRequest(UserValidation.updateUserSchema),
      ],
    },
    UserController.updateUser
  );

  // Delete User → Only Admin
  fastify.delete(
    "/:id",
    {
      preHandler: [auth(UserRole.ADMIN)],
    },
    UserController.deleteUser
  );
}