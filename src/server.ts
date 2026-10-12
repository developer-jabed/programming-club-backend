import "dotenv/config";
import { createServer } from "http";
import { Server } from "socket.io";

import buildApp from "./app.js";
import { prisma } from "./app/shared/prisma.js";
import { verifyCloudinary } from "./app/helper/fileUploader.js";
import { seedAdmin } from "./app/helper/seedAdmin.js";
import { registerChatGateway } from "./app/modules/chat/chat.gateway.js";

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST ?? "0.0.0.0";

const start = async (): Promise<void> => {
  const app = await buildApp();

  // Create raw HTTP server from Fastify
  const httpServer = createServer(app.server);

  // Create Socket.io server
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || "*",
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  // Register chat gateway
  registerChatGateway(io);

  // Make io available inside Fastify (optional)
  app.decorate("io", io);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`⚠️ Received ${signal}. Shutting down...`);

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
    app.log.error(reason);
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    app.log.error(error);
    process.exit(1);
  });

  try {
    // Connect Database
    await prisma.$connect();
    app.log.info("✅ Database connected");

    // Seed Default Admin
    await seedAdmin();
    app.log.info("✅ Admin seeding completed");

    // Verify Cloudinary
    try {
      await verifyCloudinary();
      app.log.info("✅ Cloudinary connected");
    } catch (error) {
      app.log.warn("⚠️ Cloudinary connection failed");
    }

    // Start HTTP + Socket.io server
    httpServer.listen(PORT, HOST, () => {
      app.log.info(`🚀 Server running at http://localhost:${PORT}`);
      app.log.info(`🔌 Socket.io ready`);
      app.log.info(`🌍 Environment: ${process.env.NODE_ENV ?? "development"}`);
      app.log.info(`🏥 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    app.log.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

void start();