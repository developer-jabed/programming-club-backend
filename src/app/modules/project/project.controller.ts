import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { ProjectService } from "./project.service.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../helper/pick.js";
import type { JwtPayload } from "../auth/auth.interface.js";

const createProject = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const result = await ProjectService.createProject(user.id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Project created successfully",
    data: result,
  });
};

const getAllProjects = async (req: FastifyRequest, reply: FastifyReply) => {
  const filters = pick(req.query as any, ["searchTerm", "status", "isPublic", "ownerId"]);
  const result = await ProjectService.getAllProjects(filters, req.query as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Projects retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getSingleProject = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const result = await ProjectService.getSingleProject(id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project retrieved successfully",
    data: result,
  });
};

const updateProject = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await ProjectService.updateProject(id, user.id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project updated successfully",
    data: result,
  });
};

const deleteProject = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await ProjectService.deleteProject(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project deleted successfully",
    data: result,
  });
};

const requestToJoin = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };
  const result = await ProjectService.requestToJoin(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Contribution request sent successfully",
    data: result,
  });
};

const handleRequest = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { projectId, memberId } = req.params as any;
  const { status } = req.body as { status: "ACTIVE" | "REJECTED" };

  const result = await ProjectService.handleContributionRequest(
    projectId,
    memberId,
    user.id,
    status
  );

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Request ${status.toLowerCase()} successfully`,
    data: result,
  });
};

export const ProjectController = {
  createProject,
  getAllProjects,
  getSingleProject,
  updateProject,
  deleteProject,
  requestToJoin,
  handleRequest,
};