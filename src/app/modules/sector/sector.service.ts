import { Prisma, SectorMemberRole } from "@prisma/client";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";
import { prisma } from "../../shared/prisma.js";
import type { ICreateSector, ISectorFilter, IUpdateSector } from "./sector.interface.js";

const createSector = async (payload: ICreateSector) => {
  const isExist = await prisma.sector.findFirst({
    where: {
      OR: [{ name: payload.name }, { slug: payload.slug }],
    },
  });

  if (isExist) {
    throw new ApiError(httpStatus.CONFLICT, "Sector with this name or slug already exists");
  }

  return prisma.sector.create({ data: payload });
};

const getAllSectors = async (filters: ISectorFilter, query: PaginationQuery) => {
  const { page, limit, skip, take, sortBy, sortOrder } = calculatePagination(query);
  const { searchTerm, isActive } = filters;

  const where: Prisma.SectorWhereInput = {};

  if (searchTerm) {
    where.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { description: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [data, total] = await Promise.all([
    prisma.sector.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy || "order"]: sortOrder || "asc" },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
            tasks: true,
            tests: true,
          },
        },
      },
    }),
    prisma.sector.count({ where }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data,
  };
};

const getSingleSector = async (id: string) => {
  const sector = await prisma.sector.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
              role: true,
              group: true,
              semester: true,
            },
          },
        },
      },
      _count: {
        select: {
          projects: true,
          tasks: true,
          tests: true,
          members: true,
        },
      },
    },
  });

  if (!sector) {
    throw new ApiError(httpStatus.NOT_FOUND, "Sector not found");
  }

  return sector;
};

const updateSector = async (id: string, payload: IUpdateSector) => {
  const sector = await prisma.sector.findUnique({ where: { id } });
  if (!sector) {
    throw new ApiError(httpStatus.NOT_FOUND, "Sector not found");
  }

  return prisma.sector.update({
    where: { id },
    data: payload,
  });
};

const deleteSector = async (id: string) => {
  const sector = await prisma.sector.findUnique({ where: { id } });
  if (!sector) {
    throw new ApiError(httpStatus.NOT_FOUND, "Sector not found");
  }

  return prisma.sector.delete({ where: { id } });
};

const joinSector = async (sectorId: string, userId: string) => {
  const sector = await prisma.sector.findUnique({ where: { id: sectorId } });
  if (!sector || !sector.isActive) {
    throw new ApiError(httpStatus.NOT_FOUND, "Sector not found or inactive");
  }

  const existing = await prisma.sectorMember.findUnique({
    where: { sectorId_userId: { sectorId, userId } },
  });

  if (existing) {
    throw new ApiError(httpStatus.CONFLICT, "You are already a member of this sector");
  }

  return prisma.sectorMember.create({
    data: {
      sectorId,
      userId,
      role: SectorMemberRole.MEMBER,
    },
  });
};

const leaveSector = async (sectorId: string, userId: string) => {
  const membership = await prisma.sectorMember.findUnique({
    where: { sectorId_userId: { sectorId, userId } },
  });

  if (!membership) {
    throw new ApiError(httpStatus.NOT_FOUND, "You are not a member of this sector");
  }

  return prisma.sectorMember.delete({
    where: { sectorId_userId: { sectorId, userId } },
  });
};

const getSectorMembers = async (sectorId: string) => {
  return prisma.sectorMember.findMany({
    where: { sectorId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          profilePicture: true,
          email: true,
          role: true,
          group: true,
          semester: true,
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
};

export const SectorService = {
  createSector,
  getAllSectors,
  getSingleSector,
  updateSector,
  deleteSector,
  joinSector,
  leaveSector,
  getSectorMembers,
};