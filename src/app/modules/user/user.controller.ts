import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { UserService } from "./user.service.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../helper/pick.js";
import type { IUserCreate, IUserUpdate } from "./user.interface.js";
import { parseBodyAndFile } from "../../helper/parseMultipart.js";

const createUser = async (req: FastifyRequest, reply: FastifyReply) => {
  // multipart: JSON in `data` field + image in `file` part
  // json: falls back to req.body
  const { data, file } = await parseBodyAndFile<IUserCreate>(req);

  const result = await UserService.createUser(data, file);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User created successfully",
    data: result,
  });
};

const updateUser = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };

  const { data, file } = await parseBodyAndFile<IUserUpdate>(req);

  const result = await UserService.updateUser(id, data, file);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User updated successfully",
    data: result,
  });
};

const getAllUsers = async (req: FastifyRequest, reply: FastifyReply) => {
  const filters = pick(req.query as any, [
    "searchTerm",
    "role",
    "status",
    "semester",
    "shift",
    "group",
    "bloodGroup",
  ]);

  const result = await UserService.getAllUsers(filters, req.query as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getSingleUser = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const result = await UserService.getSingleUser(id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User retrieved successfully",
    data: result,
  });
};

const deleteUser = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const result = await UserService.deleteUser(id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User deleted successfully",
    data: result,
  });
};

export const UserController = {
  createUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
};