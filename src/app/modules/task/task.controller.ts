import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { TaskService } from "./task.service.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../helper/pick.js";
import type { JwtPayload } from "../auth/auth.interface.js";

const createTask = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const result = await TaskService.createTask(user.id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Task created successfully",
    data: result,
  });
};

const getAllTasks = async (req: FastifyRequest, reply: FastifyReply) => {
  const filters = pick(req.query as any, [
    "searchTerm",
    "status",
    "priority",
    "projectId",
    "createdById",
  ]);
  const result = await TaskService.getAllTasks(filters, req.query as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tasks retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getSingleTask = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const result = await TaskService.getSingleTask(id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task retrieved successfully",
    data: result,
  });
};

const updateTask = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await TaskService.updateTask(id, user.id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task updated successfully",
    data: result,
  });
};

const deleteTask = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await TaskService.deleteTask(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task deleted successfully",
    data: result,
  });
};

export const TaskController = {
  createTask,
  getAllTasks,
  getSingleTask,
  updateTask,
  deleteTask,
};