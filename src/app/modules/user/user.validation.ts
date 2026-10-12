import { z } from "zod";
import { UserRole, UserStatus, Shift } from "@prisma/client";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.nativeEnum(UserRole).optional(),
  phone: z.string().optional(),
  roll: z.string().optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  shift: z.nativeEnum(Shift).optional(),
  group: z.string().optional(),
  registration: z.string().optional(),
  bloodGroup: z.string().optional(),
  presentAddress: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  roll: z.string().optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  shift: z.nativeEnum(Shift).optional(),
  group: z.string().optional(),
  registration: z.string().optional(),
  bloodGroup: z.string().optional(),
  presentAddress: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
  password: z.string().min(6).optional(),
});

export const UserValidation = {
  createUserSchema,
  updateUserSchema,
};