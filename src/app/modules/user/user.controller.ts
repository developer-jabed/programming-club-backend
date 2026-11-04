import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { UserService } from "./user.service.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../helper/pick.js";
import type { MultipartFile } from "@fastify/multipart";

const createUser = async (req: FastifyRequest, reply: FastifyReply) => {
  let file: MultipartFile | undefined;

  // Only try to read file if the request is multipart
  if (req.isMultipart()) {
    file = await req.file();
  }

  const data = req.body as any;

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
  let file: MultipartFile | undefined;

  if (req.isMultipart()) {
    file = await req.file();
  }

  const data = req.body as any;

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