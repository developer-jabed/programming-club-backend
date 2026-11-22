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
import { fileUploader, type UploadedFile } from "../../helper/fileUploader.js";
import type { MultipartFile } from "@fastify/multipart";
import { prisma } from "../../shared/prisma.js";
import { sendWelcomeEmail } from "./mail.service.js";

const UserSearchableFields = [
  "name",
  "email",
  "roll",
  "registration",
  "phone",
  "group",
];

// Only these fields can be used for exact filtering / sorting from the query string
const ALLOWED_FILTER_FIELDS = [
  "role",
  "status",
  "semester",
  "shift",
  "group",
  "roll",
  "registration",
  "bloodGroup",
];
const ALLOWED_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "name",
  "email",
  "roll",
  "semester",
  "lastLoginAt",
];

// Fields a client must never be able to set through the update payload
const BLOCKED_UPDATE_FIELDS = ["id", "passwordHash", "createdAt", "updatedAt", "lastLoginAt"];

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const PROFILE_FOLDER = "programming-club/profile";

const USER_SELECT = {
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
} satisfies Prisma.UserSelect;

// Validates and uploads a profile picture, returns its secure URL
const uploadProfilePicture = async (file: MultipartFile): Promise<string> => {
  let uploadedFile: UploadedFile;

  try {
    // Reads the buffer and detects the real MIME type
    uploadedFile = await fileUploader.readFileBuffer(file);
  } catch (error: any) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      error?.message || "Invalid file"
    );
  }

  // readFileBuffer also allows PDFs, but a profile picture must be an image
  if (!ALLOWED_IMAGE_TYPES.includes(uploadedFile.mimetype)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Only JPG, PNG, WebP or GIF images are allowed"
    );
  }

  if (uploadedFile.buffer.length > MAX_IMAGE_SIZE) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Image must be 5MB or smaller");
  }

  const result = await fileUploader.uploadToCloudinary(
    uploadedFile,
    PROFILE_FOLDER
  );
  return result.secure_url;
};

// Converts one query-string filter into a safe Prisma condition
const buildFilterCondition = (key: string, value: unknown): Prisma.UserWhereInput => {
  if (key === "semester") {
    const semester = Number(value);
    if (!Number.isInteger(semester)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "semester must be a number");
    }
    return { semester };
  }
  if (key === "role") {
    if (!Object.values(UserRole).includes(value as UserRole)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid role filter");
    }
    return { role: value as UserRole };
  }
  if (key === "status") {
    if (!Object.values(UserStatus).includes(value as UserStatus)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status filter");
    }
    return { status: value as UserStatus };
  }
  if (key === "shift") {
    if (!["DAY", "EVENING", "NIGHT"].includes(String(value))) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid shift filter");
    }
    return { shift: value as any };
  }
  return { [key]: { equals: value } } as Prisma.UserWhereInput;
};

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

  if (payload.registration) {
    const registrationExist = await prisma.user.findUnique({
      where: { registration: payload.registration },
    });
    if (registrationExist) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "User already exists with this registration number"
      );
    }
  }

  const hashedPassword = await bcrypt.hash(payload.password, 12);

  let profilePicture: string | undefined;

  if (file) {
    profilePicture = await uploadProfilePicture(file);
  }

  let result: User;
  try {
    result = await prisma.user.create({
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
  } catch (error) {
    // Two requests with the same email/registration at the same time
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Email or registration number already exists"
      );
    }
    throw error;
  }

  // Welcome email with login details. sendWelcomeEmail never throws, so a mail
  // problem will not undo the created account. Not awaited: the API responds fast.
  void sendWelcomeEmail({
    name: result.name,
    email: result.email,
    password: payload.password, // plain password from the request, not the hash
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

  const { searchTerm, ...filterData } = filters as Record<string, any>;
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

  // Exact filters (whitelisted, empty values ignored)
  const filterConditions = Object.entries(filterData)
    .filter(
      ([key, value]) =>
        ALLOWED_FILTER_FIELDS.includes(key) &&
        value !== undefined &&
        value !== null &&
        value !== ""
    )
    .map(([key, value]) => buildFilterCondition(key, value));

  if (filterConditions.length > 0) {
    andConditions.push({ AND: filterConditions });
  }

  const whereConditions: Prisma.UserWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const safeSortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : "createdAt";

  const [result, total] = await Promise.all([
    prisma.user.findMany({
      where: whereConditions,
      skip,
      take,
      orderBy: {
        [safeSortBy]: sortOrder,
      },
      select: USER_SELECT,
    }),
    prisma.user.count({ where: whereConditions }),
  ]);

  return {
    meta: buildPaginationMeta(total, { page, limit, skip, take, sortBy: safeSortBy, sortOrder }),
    data: result,
  };
};

const getSingleUser = async (id: string) => {
  const result = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
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

  // IUserUpdate has no `email` field, so extend the type locally
  const body: IUserUpdate & { email?: string } = payload;

  const dataToUpdate: any = { ...body };

  // Never let the client set internal fields
  for (const field of BLOCKED_UPDATE_FIELDS) {
    delete dataToUpdate[field];
  }

  // Email / registration must stay unique
  if (body.email && body.email !== isExist.email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: body.email },
    });
    if (emailTaken) {
      throw new ApiError(httpStatus.CONFLICT, "Email is already in use");
    }
  }

  if (payload.registration && payload.registration !== isExist.registration) {
    const registrationTaken = await prisma.user.findUnique({
      where: { registration: payload.registration },
    });
    if (registrationTaken) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Registration number is already in use"
      );
    }
  }

  if (file) {
    // New upload replaces the old picture
    dataToUpdate.profilePicture = await uploadProfilePicture(file);
  } else if ((payload as any).profilePicture === null) {
    // Explicit removal
    dataToUpdate.profilePicture = null;
  } else {
    // Keep the existing picture (never trust a client-sent URL)
    delete dataToUpdate.profilePicture;
  }

  if (payload.password) {
    dataToUpdate.passwordHash = await bcrypt.hash(payload.password, 12);
  }
  delete dataToUpdate.password;

  try {
    return await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: USER_SELECT,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Email or registration number already exists"
      );
    }
    throw error;
  }
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
    select: USER_SELECT, // never return passwordHash
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