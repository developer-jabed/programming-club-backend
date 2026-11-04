import fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import compress from "@fastify/compress";
import pinoPretty from "pino-pretty";
import path from "path";
import { randomUUID } from "crypto";

import config from "./app/config/index.js";
import queuePlugin from "./app/shared/queue.js";
import globalErrorHandler from "./app/middlewares/globalErrorHandler.js";
import notFound from "./app/middlewares/notFound.js";
import registerRoutes from "./app/routes/index.js";
import { registerGlobalRateLimit } from "./app/middlewares/rateLimiter.js";

const buildApp = async () => {
  const app = fastify({
    logger: config.isDev
      ? {
          level: "debug",
          stream: pinoPretty({
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          }),
        }
      : { level: "info" },
    trustProxy: true,
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID(),
  });

  // ── Request ID propagation ─────────────────────────────────
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  // ── Security ───────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: config.isProd,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow non-browser requests (no Origin header)
      if (!origin) return cb(null, true);

      if (
        config.allowed_origins.includes(origin) ||
        config.allowed_origins.includes("*")
      ) {
        return cb(null, true);
      }

      cb(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    credentials: true,
  });

  // Global rate limit
  await registerGlobalRateLimit(app);

  // ── Compression ────────────────────────────────────────────
  await app.register(compress, { global: true });

  // ── Cookies ────────────────────────────────────────────────
  await app.register(cookie, {
    secret: config.cookie_secret,
  });

  // ── File uploads ───────────────────────────────────────────
  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 5,
    },
  });

  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "public"),
    prefix: "/",
  });

  // ── Swagger / OpenAPI ──────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Programming Club API",
        description:
          "Backend for Programming Club Management System – Sectors, Projects, Tasks, Tests, Chat & Analytics",
        version: "1.1.0",
      },
      servers: [
        {
          url: config.app_url || `http://localhost:${config.port}`,
          description: "Current",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  // ── Queue (BullMQ) ─────────────────────────────────────────
  await app.register(queuePlugin);

  app.addHook("onReady", () => {
    app.log.info("✅ Server is ready and accepting connections");
  });

  app.addHook("onClose", (_instance, done) => {
    app.log.info("🛑 Server is shutting down...");
    done();
  });

  // ── Health check ───────────────────────────────────────────
  app.get("/health", async (_request, reply) => {
    reply.send({
      success: true,
      message: "Server is healthy 🚀",
      timestamp: new Date().toISOString(),
      environment: config.node_env,
      version: "1.1.0",
    });
  });

  // ── Routes ─────────────────────────────────────────────────
  await app.register(
    async (instance) => {
      await registerRoutes(instance);
    },
    { prefix: "/api/v1" }
  );

  // ── Error handlers ─────────────────────────────────────────
  globalErrorHandler(app);
  app.setNotFoundHandler(notFound);

  return app;
};

export default buildApp;