import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { ProjectController } from "./project.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { ProjectValidation } from "./project.validation.js";

export default async function projectRoutes(fastify: FastifyInstance) {
  // Create Project
  fastify.post(
    "/",
    {
      preHandler: [
        auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER),
        validateRequest(ProjectValidation.createProjectSchema),
      ],
    },
    ProjectController.createProject
  );

  // Get All Projects
  fastify.get("/", ProjectController.getAllProjects);

  // Get Single Project
  fastify.get("/:id", ProjectController.getSingleProject);

  // Update Project
  fastify.patch(
    "/:id",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)],
    },
    ProjectController.updateProject
  );

  // Delete Project
  fastify.delete(
    "/:id",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)],
    },
    ProjectController.deleteProject
  );

  // Request to join
  fastify.post(
    "/:id/request",
    {
      preHandler: [auth(UserRole.MEMBER, UserRole.MODERATOR, UserRole.ADMIN)],
    },
    ProjectController.requestToJoin
  );

  // Accept / Reject request
  fastify.patch(
    "/:projectId/members/:memberId",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER)],
    },
    ProjectController.handleRequest
  );
}