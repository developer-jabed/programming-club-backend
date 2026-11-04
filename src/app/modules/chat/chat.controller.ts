import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { ChatService } from "./chat.service.js";
import sendResponse from "../../shared/sendResponse.js";
import type { JwtPayload } from "../auth/auth.interface.js";

const sendMessage = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { projectId } = req.params as { projectId: string };

  const result = await ChatService.sendMessage(projectId, user.id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
};

const getProjectMessages = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { projectId } = req.params as { projectId: string };

  const result = await ChatService.getProjectMessages(
    projectId,
    user.id,
    req.query as any
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const deleteMessage = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { messageId } = req.params as { messageId: string };

  await ChatService.deleteMessage(messageId, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Message deleted successfully",
  });
};

export const ChatController = {
  sendMessage,
  getProjectMessages,
  deleteMessage,
};