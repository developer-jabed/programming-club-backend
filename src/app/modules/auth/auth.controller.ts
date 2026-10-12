import httpStatus from "http-status";
import type { FastifyReply, FastifyRequest } from "fastify";
import config from "../../config/index.js";
import catchAsync from "../../shared/catchAsync.js";
import { AuthService } from "./auth.service.js";
import sendResponse from "../../shared/sendResponse.js";
import type { JwtPayload } from "./auth.interface.js";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from "./auth.constants.js";

const cookieOptions = {
  secure: config.node_env === "production",
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

const loginUser = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const result = await AuthService.loginUser(request.body as any);
  const { accessToken, refreshToken, user } = result;

  reply
    .setCookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60, // 1 day
    })
    .setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged in successfully",
    data: { user },
  });
});

const refreshToken = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const token = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

  if (!token) {
    throw new (await import("../../errors/api.error.js")).default(
      httpStatus.UNAUTHORIZED,
      "Refresh token not found"
    );
  }

  const result = await AuthService.refreshToken(token);

  reply.setCookie(ACCESS_TOKEN_COOKIE_NAME, result.accessToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60,
  });

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Access token refreshed successfully",
    data: result,
  });
});

const changePassword = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const user = (request as FastifyRequest & { user: JwtPayload }).user;

  await AuthService.changePassword(user, request.body as any);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully",
  });
});

const getMe = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  const user = (request as FastifyRequest & { user: JwtPayload }).user;

  const result = await AuthService.getMe(user);

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const logout = catchAsync(async (request: FastifyRequest, reply: FastifyReply) => {
  reply
    .clearCookie(ACCESS_TOKEN_COOKIE_NAME, { path: "/" })
    .clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: "/" });

  return sendResponse(reply, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
  });
});

export const AuthController = {
  loginUser,
  refreshToken,
  changePassword,
  getMe,
  logout,
};