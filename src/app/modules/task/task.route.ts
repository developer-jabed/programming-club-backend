import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { TaskController } from "./task.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { TaskValidation } from "./task.validation.js";

export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/",
    {
      preHandler: [
        auth(UserRole.ADMIN, UserRole.MODERATOR),
        validateRequest(TaskValidation.createTaskSchema),
      ],
    },
    TaskController.createTask
  );

  fastify.get("/", { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)] }, TaskController.getAllTasks);

  fastify.get("/:id", { preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)] }, TaskController.getSingleTask);

  fastify.patch(
    "/:id",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    TaskController.updateTask
  );

  fastify.delete(
    "/:id",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    TaskController.deleteTask
  );
}