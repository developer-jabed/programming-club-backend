import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { TaskController } from "./task.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { TaskValidation } from "./task.validation.js";

export default async function taskRoutes(fastify: FastifyInstance) {
  const anyRole = auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER);
  const staff = auth(UserRole.ADMIN, UserRole.MODERATOR);

  fastify.post(
    "/",
    { preHandler: [staff, validateRequest(TaskValidation.createTaskSchema)] },
    TaskController.createTask
  );

  // Staff only: members use GET /tasks/my instead
  fastify.get("/", { preHandler: [staff] }, TaskController.getAllTasks);

  fastify.get(
    "/project/:projectId",
    { preHandler: [anyRole] },
    TaskController.getProjectTasks
  );

  // Tasks assigned to me, with my own submissions (any logged-in role)
  fastify.get("/my", { preHandler: [anyRole] }, TaskController.getMyTasks);

  fastify.get("/:id", { preHandler: [anyRole] }, TaskController.getSingleTask);

  fastify.patch("/:id", { preHandler: [staff] }, TaskController.updateTask);
  fastify.delete("/:id", { preHandler: [staff] }, TaskController.deleteTask);
}