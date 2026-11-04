import { UserRole, UserStatus, Shift } from "@prisma/client";

export type IUserFilterRequest = {
  searchTerm?: string;
  role?: UserRole;
  status?: UserStatus;
  semester?: number;
  shift?: Shift;
  group?: string;
  bloodGroup?: string;
};

export type IUserCreate = {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  phone?: string;
  roll?: string;
  semester?: number;
  shift?: Shift;
  group?: string;
  registration?: string;
  bloodGroup?: string;
  presentAddress?: string;
};

export type IUserUpdate = Partial<Omit<IUserCreate, "email" | "password">> & {
  status?: UserStatus;
  password?: string;
};