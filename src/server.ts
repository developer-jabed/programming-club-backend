import "dotenv/config";
import { Server } from "socket.io";

import buildApp from "./app.js";
import { prisma } from "./app/shared/prisma.js";
import { verifyCloudinary } from "./app/helper/fileUploader.js";
import { seedAdmin } from "./app/helper/seedAdmin.js";
import { registerChatGateway } from "./app/modules/chat/chat.gateway.js";
import config from "./app/config/index.js";

const start = async (): Promise<void> => {
  const app = await buildApp();

  // Attach Socket.IO directly to Fastify's underlying HTTP server
  const io = new Server(app.server, {
    cors: {
      origin: config.allowed_origins.length ? config.allowed_origins : false,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // Register authenticated chat gateway
  registerChatGateway(io);

  // Make io available inside Fastify
  app.decorate("io", io);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`⚠️ Received ${signal}. Shutting down gracefully...`);

    try {
      io.close();
      await app.close();
      app.log.info("✅ Fastify + Socket.io closed");

      await prisma.$disconnect();
      app.log.info("✅ Prisma disconnected");

      process.exit(0);
    } catch (error) {
      app.log.error(error);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    app.log.error({ reason }, "Unhandled Rejection");
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    app.log.error(error, "Uncaught Exception");
    process.exit(1);
  });

  try {
    // Connect Database
    await prisma.$connect();
    app.log.info("✅ Database connected");

    // Seed Default Admin
    await seedAdmin();
    app.log.info("✅ Admin seeding completed");


    try {
      await verifyCloudinary();
      app.log.info("✅ Cloudinary connected");
    } catch {
      app.log.warn("⚠️ Cloudinary connection failed – file uploads may not work");
    }

    // Start the server (Fastify owns the listen)
    await app.listen({
      port: config.port,
      host: config.host || "0.0.0.0",
    });

    app.log.info(`🚀 Server running at http://${config.host || "0.0.0.0"}:${config.port}`);
    app.log.info(`📚 Swagger docs   → http://localhost:${config.port}/docs`);
    app.log.info(`🔌 Socket.io ready (JWT auth required)`);
    app.log.info(`🌍 Environment: ${config.node_env}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();