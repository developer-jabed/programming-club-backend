import type { FastifyRequest, FastifyReply } from "fastify";
import httpStatus from "http-status";
import { SectorService } from "./sector.service.js";
import sendResponse from "../../shared/sendResponse.js";
import pick from "../../helper/pick.js";
import type { JwtPayload } from "../auth/auth.interface.js";

const createSector = async (req: FastifyRequest, reply: FastifyReply) => {
  const result = await SectorService.createSector(req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Sector created successfully",
    data: result,
  });
};

const getAllSectors = async (req: FastifyRequest, reply: FastifyReply) => {
  const filters = pick(req.query as any, ["searchTerm", "isActive"]);
  if (filters.isActive !== undefined) {
    filters.isActive = filters.isActive === "true";
  }

  const result = await SectorService.getAllSectors(filters, req.query as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sectors retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
};

const getSingleSector = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const result = await SectorService.getSingleSector(id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sector retrieved successfully",
    data: result,
  });
};

const updateSector = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const result = await SectorService.updateSector(id, req.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sector updated successfully",
    data: result,
  });
};

const deleteSector = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  await SectorService.deleteSector(id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sector deleted successfully",
  });
};

const joinSector = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };

  const result = await SectorService.joinSector(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Joined sector successfully",
    data: result,
  });
};

const leaveSector = async (req: FastifyRequest, reply: FastifyReply) => {
  const user = (req as any).user as JwtPayload;
  const { id } = req.params as { id: string };

  await SectorService.leaveSector(id, user.id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Left sector successfully",
  });
};

const getSectorMembers = async (req: FastifyRequest, reply: FastifyReply) => {
  const { id } = req.params as { id: string };
  const result = await SectorService.getSectorMembers(id);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Sector members retrieved successfully",
    data: result,
  });
};

export const SectorController = {
  createSector,
  getAllSectors,
  getSingleSector,
  updateSector,
  deleteSector,
  joinSector,
  leaveSector,
  getSectorMembers,
};