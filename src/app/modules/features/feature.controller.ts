import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import sendResponse from "../../shared/sendResponse.js";
import type { JwtPayload } from "../auth/auth.interface.js";
import { FeatureService } from "./feature.service.js";
import type {
  ICreateFeatureRequest,
  IUpdateFeatureRequest,
  ICreateFeatureRequestReply,
  ICreateFeatureUpdate,
  IUpdateFeatureUpdate,
} from "./feature.interface.js";

const createFeatureRequest = async (
  req: FastifyRequest<{ Body: ICreateFeatureRequest }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeatureService.createFeatureRequest(user.id, req.body);

  sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Feature request created successfully",
    data: result,
  });
};

const getFeatureRequests = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = req.user as JwtPayload | undefined;
  const result = await FeatureService.getFeatureRequests(req.query as any, user);

  sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feature requests retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getFeatureRequestById = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const result = await FeatureService.getFeatureRequestById(req.params.id);

  sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feature request retrieved successfully",
    data: result,
  });
};

const updateFeatureRequest = async (
  req: FastifyRequest<{ Params: { id: string }; Body: IUpdateFeatureRequest }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeatureService.updateFeatureRequest(
    req.params.id,
    user.id,
    user.role,
    req.body
  );

  sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feature request updated successfully",
    data: result,
  });
};

const deleteFeatureRequest = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeatureService.deleteFeatureRequest(
    req.params.id,
    user.id,
    user.role
  );

  sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
};

const createReply = async (
  req: FastifyRequest<{ Params: { id: string }; Body: ICreateFeatureRequestReply }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeatureService.createReply(
    req.params.id,
    user.id,
    user.role,
    req.body
  );

  sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Reply added successfully",
    data: result,
  });
};

const deleteReply = async (
  req: FastifyRequest<{ Params: { replyId: string } }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeatureService.deleteReply(
    req.params.replyId,
    user.id,
    user.role
  );

  sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
};

// ==================== Feature Updates ====================

const createFeatureUpdate = async (
  req: FastifyRequest<{ Body: ICreateFeatureUpdate }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeatureService.createFeatureUpdate(user.id, user.role, req.body);

  sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Feature update created successfully",
    data: result,
  });
};

const getFeatureUpdates = async (req: FastifyRequest, reply: FastifyReply) => {
  const result = await FeatureService.getFeatureUpdates(req.query as any);

  sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feature updates retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getFeatureUpdateById = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const result = await FeatureService.getFeatureUpdateById(req.params.id);

  sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feature update retrieved successfully",
    data: result,
  });
};

const updateFeatureUpdate = async (
  req: FastifyRequest<{ Params: { id: string }; Body: IUpdateFeatureUpdate }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeatureService.updateFeatureUpdate(
    req.params.id,
    user.id,
    user.role,
    req.body
  );

  sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feature update updated successfully",
    data: result,
  });
};

const deleteFeatureUpdate = async (
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const user = req.user as JwtPayload;
  const result = await FeatureService.deleteFeatureUpdate(req.params.id, user.role);

  sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.message,
    data: null,
  });
};

export const FeatureController = {
  createFeatureRequest,
  getFeatureRequests,
  getFeatureRequestById,
  updateFeatureRequest,
  deleteFeatureRequest,
  createReply,
  deleteReply,
  createFeatureUpdate,
  getFeatureUpdates,
  getFeatureUpdateById,
  updateFeatureUpdate,
  deleteFeatureUpdate,
};