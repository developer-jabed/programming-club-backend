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

  // Create feature request
  fastify.post<{ Body: ICreateFeatureRequest }>(
    "/requests",
    {
      preHandler: [auth(), validateRequest(FeatureValidation.createFeatureRequest)],
    },
    FeatureController.createFeatureRequest
  );

  // Get all feature requests (optional auth)
  fastify.get(
    "/requests",
 
    FeatureController.getFeatureRequests
  );

  // Get single feature request
  fastify.get<{ Params: { id: string } }>(
    "/requests/:id",
  
    FeatureController.getFeatureRequestById
  );

  // Update feature request (owner or admin)
  fastify.patch<{ Params: { id: string }; Body: IUpdateFeatureRequest }>(
    "/requests/:id",
    {
      preHandler: [auth(), validateRequest(FeatureValidation.updateFeatureRequest)],
    },
    FeatureController.updateFeatureRequest
  );

  // Delete feature request
  fastify.delete<{ Params: { id: string } }>(
    "/requests/:id",
    {
      preHandler: [auth()],
    },
    FeatureController.deleteFeatureRequest
  );

  // Add reply
  fastify.post<{ Params: { id: string }; Body: ICreateFeatureRequestReply }>(
    "/requests/:id/replies",
    {
      preHandler: [auth(), validateRequest(FeatureValidation.createReply)],
    },
    FeatureController.createReply
  );

  // Delete reply
  fastify.delete<{ Params: { replyId: string } }>(
    "/replies/:replyId",
    {
      preHandler: [auth()],
    },
    FeatureController.deleteReply
  );

  // ==================== Feature Updates / Technical Reports ====================

  // Create update (Admin / Moderator only)
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

  // Get all updates
  fastify.get(
    "/updates",
 
    FeatureController.getFeatureUpdates
  );

  // Get single update
  fastify.get<{ Params: { id: string } }>(
    "/updates/:id",
   
    FeatureController.getFeatureUpdateById
  );

  // Update
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

  // Delete
  fastify.delete<{ Params: { id: string } }>(
    "/updates/:id",
    {
      preHandler: [auth(UserRole.ADMIN, UserRole.MODERATOR)],
    },
    FeatureController.deleteFeatureUpdate
  );
} 