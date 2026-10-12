import { Prisma, UserRole, UserStatus } from "@prisma/client";
import type { User } from "@prisma/client";
import bcrypt from "bcrypt";
import httpStatus from "http-status";
import ApiError from "../../errors/api.error.js";
import {
  calculatePagination,
  buildPaginationMeta,
  type PaginationQuery,
} from "../../helper/paginationHelper.js";

import type {
  IUserCreate,
  IUserFilterRequest,
  IUserUpdate,
} from "./user.interface.js";
import { fileUploader } from "../../helper/fileUploader.js";
import type { MultipartFile } from "@fastify/multipart";
import { prisma } from "../../shared/prisma.js";

const UserSearchableFields = [
  "name",
  "email",
  "roll",
  "registration",
  "phone",
  "group",
];

const createUser = async (
  payload: IUserCreate,
  file?: MultipartFile
): Promise<Partial<User>> => {
  const isExist = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (isExist) {
    throw new ApiError(httpStatus.CONFLICT, "User already exists with this email");
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);

  let profilePicture: string | undefined;

  if (file) {
    const uploadedFile = await fileUploader.readFileBuffer(file);
    const result = await fileUploader.uploadToCloudinary(
      uploadedFile,
      "programming-club/profile"
    );
    profilePicture = result.secure_url;
  }

  const result = await prisma.user.create({
    data: {
      email: payload.email,
      passwordHash: hashedPassword,
      name: payload.name,
      role: payload.role || UserRole.MEMBER,
      phone: payload.phone,
      roll: payload.roll,
      semester: payload.semester,
      shift: payload.shift,
      group: payload.group,
      registration: payload.registration,
      bloodGroup: payload.bloodGroup,
      presentAddress: payload.presentAddress,
      profilePicture,
      status: UserStatus.ACTIVE,
    },
  });

  const { passwordHash, ...userWithoutPassword } = result;
  return userWithoutPassword;
};

const getAllUsers = async (
  filters: IUserFilterRequest,
  query: PaginationQuery
) => {
  const { page, limit, skip, take, sortBy, sortOrder } =
    calculatePagination(query);

  const { searchTerm, ...filterData } = filters;
  const andConditions: Prisma.UserWhereInput[] = [];

  // Search
  if (searchTerm) {
    andConditions.push({
      OR: UserSearchableFields.map((field) => ({
        [field]: {
          contains: searchTerm,
          mode: "insensitive",
        },
      })),
    });
  }

  // Exact filters
  if (Object.keys(filterData).length > 0) {
    andConditions.push({
      AND: Object.entries(filterData).map(([key, value]) => ({
        [key]: { equals: value },
      })),
    });
  }

  const whereConditions: Prisma.UserWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [result, total] = await Promise.all([
    prisma.user.findMany({
      where: whereConditions,
      skip,
      take,
      orderBy: {
        [sortBy]: sortOrder,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        profilePicture: true,
        phone: true,
        roll: true,
        semester: true,
        shift: true,
        group: true,
        registration: true,
        bloodGroup: true,
        presentAddress: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    }),
    prisma.user.count({ where: whereConditions }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy, sortOrder }),
    data: result,
  };
};

const getSingleUser = async (id: string) => {
  const result = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      profilePicture: true,
      phone: true,
      roll: true,
      semester: true,
      shift: true,
      group: true,
      registration: true,
      bloodGroup: true,
      presentAddress: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return result;
};

const updateUser = async (
  id: string,
  payload: IUserUpdate,
  file?: MultipartFile
) => {
  const isExist = await prisma.user.findUnique({ where: { id } });

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  let profilePicture = isExist.profilePicture;

  if (file) {
    const uploadedFile = await fileUploader.readFileBuffer(file);
    const result = await fileUploader.uploadToCloudinary(
      uploadedFile,
      "programming-club/profile"
    );
    profilePicture = result.secure_url;
  }

  const dataToUpdate: any = {
    ...payload,
    profilePicture,
  };

  if (payload.password) {
    dataToUpdate.passwordHash = await bcrypt.hash(payload.password, 12);
    delete dataToUpdate.password;
  }

  const result = await prisma.user.update({
    where: { id },
    data: dataToUpdate,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      profilePicture: true,
      phone: true,
      roll: true,
      semester: true,
      shift: true,
      group: true,
      registration: true,
      bloodGroup: true,
      presentAddress: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return result;
};

const deleteUser = async (id: string) => {
  const isExist = await prisma.user.findUnique({ where: { id } });

  if (!isExist) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  // Soft delete (recommended)
  const result = await prisma.user.update({
    where: { id },
    data: { status: UserStatus.INACTIVE },
  });

  return result;
};

export const UserService = {
  createUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  deleteUser,
};