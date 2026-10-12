import type { UserRole } from "@prisma/client";

export type JwtPayload = {
  id: string;
  email: string;
  role: UserRole;
};

export type ILoginRequest = {
  email: string;
  password: string;
};

export type ILoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    profilePicture: string | null;
  };
};

export type IRefreshTokenResponse = {
  accessToken: string;
};

export type IChangePasswordRequest = {
  oldPassword: string;
  newPassword: string;
};