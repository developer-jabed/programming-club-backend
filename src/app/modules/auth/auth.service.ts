import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { UserStatus } from "@prisma/client";
import type {
  IChangePasswordRequest,
  ILoginRequest,
  ILoginResponse,
  IRefreshTokenResponse,
  JwtPayload,
} from "./auth.interface.js";
import { prisma } from "../../shared/prisma.js";
import ApiError from "../../errors/api.error.js";
import { jwtHelpers } from "../../helper/jwtHelper.js";
import {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
} from "./auth.constants.js";
import config from "../../config/index.js";

const loginUser = async (payload: ILoginRequest): Promise<ILoginResponse> => {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      "Your account is not active. Please contact admin."
    );
  }

  if (!user.passwordHash) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Password not set for this account");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordMatched) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect email or password");
  }

  const jwtPayload: JwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtHelpers.generateToken(
    jwtPayload,
    config.jwt.access_secret as string,
    ACCESS_TOKEN_EXPIRES_IN
  );

  const refreshToken = jwtHelpers.generateToken(
    jwtPayload,
    config.jwt.refresh_secret as string,
    REFRESH_TOKEN_EXPIRES_IN
  );

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      profilePicture: user.profilePicture,
    },
  };
};

const refreshToken = async (token: string): Promise<IRefreshTokenResponse> => {
  let decoded: JwtPayload;

  try {
    decoded = jwtHelpers.verifyToken(
      token,
      config.jwt.refresh_secret as string
    ) as JwtPayload;
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid or expired refresh token");
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.id },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "User not found or inactive");
  }

  const jwtPayload: JwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtHelpers.generateToken(
    jwtPayload,
    config.jwt.access_secret as string,
    ACCESS_TOKEN_EXPIRES_IN
  );

  return { accessToken };
};

const changePassword = async (
  userPayload: JwtPayload,
  payload: IChangePasswordRequest
): Promise<void> => {
  const { oldPassword, newPassword } = payload;

  const user = await prisma.user.findUnique({
    where: { id: userPayload.id },
  });

  if (!user || !user.passwordHash) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  const isPasswordMatched = await bcrypt.compare(oldPassword, user.passwordHash);

  if (!isPasswordMatched) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Old password is incorrect");
  }

  const isSameAsOld = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSameAsOld) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "New password cannot be the same as the old password"
    );
  }

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds || 12)
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashedPassword,
    },
  });
};

const getMe = async (userPayload: JwtPayload) => {
  const user = await prisma.user.findUnique({
    where: { id: userPayload.id },
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
      lastLoginAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

export const AuthService = {
  loginUser,
  refreshToken,
  changePassword,
  getMe,
};