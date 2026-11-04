import type { FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";

/**
 * Global API rate limiter – applied once in app.ts
 */
export async function registerGlobalRateLimit(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: 300, // 300 requests per 15 minutes per IP
    timeWindow: 15 * 60 * 1000,
    errorResponseBuilder: () => ({
      success: false,
      message: "Too many requests from this IP, please try again later.",
    }),
  });
}

/**
 * Strict limiter for auth endpoints (login / refresh)
 * Use as: { config: authLimiter.config }
 */
export const authLimiter = {
  config: {
    rateLimit: {
      max: 8,
      timeWindow: 15 * 60 * 1000, // 8 attempts / 15 min
      errorResponseBuilder: () => ({
        success: false,
        message: "Too many authentication attempts. Please try again later.",
      }),
    },
  },
};

/**
 * Limiter for message / chat actions
 */
export const chatLimiter = {
  config: {
    rateLimit: {
      max: 30,
      timeWindow: 60 * 1000, // 30 messages / minute
      errorResponseBuilder: () => ({
        success: false,
        message: "You are sending messages too quickly. Please slow down.",
      }),
    },
  },
};
