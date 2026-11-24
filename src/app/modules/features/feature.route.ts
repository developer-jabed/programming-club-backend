import type { FastifyInstance } from "fastify";
import { UserRole } from "@prisma/client";
import auth from "../../middlewares/auth.middleware.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { FeatureValidation } from "./feature.validation.js";
import { FeatureController } from "./feature.controller.js";
import type {
  ICreateFeatureRequest,
  IUpdateFeatureRequest,
  ICreateFeatureRequestReply,
  ICreateFeatureUpdate,
  IUpdateFeatureUpdate,
} from "./feature.interface.js";

export default async function featureRoutes(fastify: FastifyInstance) {
  // ==================== Feature Requests ====================

  fastify.post<{ Body: ICreateFeatureRequest }>(
    "/requests",
    {
      preHandler: [
        auth(),
        validateRequest(FeatureValidation.createFeatureRequest),
      ],
    },
    FeatureController.createFeatureRequest
  );

  // Optional auth so hasVoted can be set when logged in
  fastify.get(
    "/requests",
    {
      // If your auth() does not support optional, leave preHandler empty
      // and rely on req.user being undefined when not logged in.
      preHandler: [],
    },
    FeatureController.getFeatureRequests
  );

  fastify.get<{ Params: { id: string } }>(
    "/requests/:id",
    { preHandler: [] },
    FeatureController.getFeatureRequestById
  );

  fastify.patch<{ Params: { id: string }; Body: IUpdateFeatureRequest }>(
    "/requests/:id",
    {
      preHandler: [
        auth(),
        validateRequest(FeatureValidation.updateFeatureRequest),
      ],
    },
    FeatureController.updateFeatureRequest
  );

  fastify.delete<{ Params: { id: string } }>(
    "/requests/:id",
    { preHandler: [auth()] },
    FeatureController.deleteFeatureRequest
  );

  // Vote toggle
  fastify.post<{ Params: { id: string } }>(
    "/requests/:id/vote",
    { preHandler: [auth()] },
    FeatureController.toggleVote
  );

  // Replies – any authenticated member
  fastify.post<{
    Params: { id: string };
    Body: ICreateFeatureRequestReply;
  }>(
    "/requests/:id/replies",
    {
      preHandler: [auth(), validateRequest(FeatureValidation.createReply)],
    },
    FeatureController.createReply
  );

  fastify.delete<{ Params: { replyId: string } }>(
    "/replies/:replyId",
    { preHandler: [auth()] },
    FeatureController.deleteReply
  );

  // ==================== Feature Updates ====================

  fastify.post<{ Body: ICreateFeatureUpdate }>(
    "/updates",
    {
      preHandler: [
        auth(UserRole.ADMIN, UserRole.MODERATOR),
        validateRequest(FeatureValidation.createFeatureUpdate),
      ],
    },
    FeatureController.createFeatureUpdate
  );

  fastify.get("/updates", FeatureController.getFeatureUpdates);

  fastify.get<{ Params: { id: string } }>(
    "/updates/:id",
    FeatureController.getFeatureUpdateById
  );

  fastify.patch<{ Params: { id: string }; Body: IUpdateFeatureUpdate }>(
    "/updates/:id",
    {
      preHandler: [
        auth(UserRole.ADMIN, UserRole.MODERATOR),
        validateRequest(FeatureValidation.updateFeatureUpdate),
      ],
    },
    FeatureController.updateFeatureUpdate
  );

  fastify.delete<{ Params: { id: string } }>(
    "/updates/:id",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    FeatureController.deleteFeatureUpdate
  );
}