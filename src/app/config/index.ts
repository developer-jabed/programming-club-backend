import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BULLMQ_REDIS_URL: z.string().min(1, "BULLMQ_REDIS_URL is required"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  COOKIE_SECRET: z.string().min(16, "COOKIE_SECRET must be at least 16 characters").optional(),
  BCRYPT_SALT_ROUNDS: z.coerce.number().min(10).max(15).default(12),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  JWT_RESET_PASSWORD_SECRET: z.string().optional(),
  JWT_RESET_PASSWORD_EXPIRES_IN: z.string().default("10m"),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  FRONTEND_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

const config = {
  node_env: env.NODE_ENV,
  isDev: env.NODE_ENV === "development",
  isProd: env.NODE_ENV === "production",
  port: env.PORT,
  host: env.HOST,
  database_url: env.DATABASE_URL,
  redis_url: env.BULLMQ_REDIS_URL,
  bcrypt_salt_rounds: env.BCRYPT_SALT_ROUNDS,
  cookie_secret: env.COOKIE_SECRET ?? env.JWT_ACCESS_SECRET,
  allowed_origins: env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),

  jwt: {
    access_secret: env.JWT_ACCESS_SECRET,
    access_expires_in: env.JWT_ACCESS_EXPIRES_IN,
    refresh_secret: env.JWT_REFRESH_SECRET,
    refresh_expires_in: env.JWT_REFRESH_EXPIRES_IN,
    reset_password_secret: env.JWT_RESET_PASSWORD_SECRET ?? env.JWT_ACCESS_SECRET,
    reset_password_expires_in: env.JWT_RESET_PASSWORD_EXPIRES_IN,
  },

  admin: {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  },

  cloudinary: {
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  },

  frontend_url: env.FRONTEND_URL,
  app_url: env.APP_URL,
} as const;

export default config;
