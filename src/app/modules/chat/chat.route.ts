import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import { ChatController } from "./chat.controller.js";
import auth from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { ChatValidation } from "./chat.validation.js";

const ALL_ROLES = [UserRole.ADMIN, UserRole.MODERATOR, UserRole.MEMBER];

export default async function chatRoutes(fastify: FastifyInstance) {
  // Get messages of a project
  fastify.get(
    "/:projectId/messages",
    { preHandler: [auth(...ALL_ROLES)] },
    ChatController.getProjectMessages
  );

  // Send message
  fastify.post(
    "/:projectId/messages",
    {
      preHandler: [
        auth(...ALL_ROLES),
        validateRequest(ChatValidation.sendMessageSchema),
      ],
    },
    ChatController.sendMessage
  );

  // Delete message
  fastify.delete(
    "/messages/:messageId",
    { preHandler: [auth(...ALL_ROLES)] },
    ChatController.deleteMessage
  );
}