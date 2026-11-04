import type { Server, Socket } from "socket.io";
import { ChatService } from "./chat.service.js";
import { jwtHelpers } from "../../helper/jwtHelper.js";
import config from "../../config/index.js";
import type { JwtPayload } from "../../helper/jwtHelper.js";

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

/**
 * In-memory simple rate limiter for socket messages (per user)
 * For production, prefer Redis-based limiter.
 */
const messageBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(userId: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = messageBuckets.get(userId);

  if (!bucket || now > bucket.resetAt) {
    messageBuckets.set(userId, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (bucket.count >= max) return true;
  bucket.count += 1;
  return false;
}

export const registerChatGateway = (io: Server) => {
  // ── Authenticate every socket connection ───────────────────
  io.use((socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "") ||
        (socket.handshake.query?.token as string | undefined);

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const payload = jwtHelpers.verifyToken(token, config.jwt.access_secret);
      socket.user = payload;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    if (!socket.user) {
      socket.disconnect(true);
      return;
    }

    const userId = socket.user.id;
    console.log(`User connected: ${socket.id} (user: ${userId})`);

    // Auto-join personal room for notifications
    socket.join(`user:${userId}`);

    // Join project room (membership check can be added later)
    socket.on("join_project", async (projectId: string) => {
      if (!projectId || typeof projectId !== "string") return;
      socket.join(`project:${projectId}`);
    });

    socket.on("leave_project", (projectId: string) => {
      if (!projectId) return;
      socket.leave(`project:${projectId}`);
    });

    // Send message – never trust client-sent userId
    socket.on(
      "send_message",
      async (data: { projectId: string; content: string; replyToId?: string }) => {
        try {
          if (!data?.projectId || !data?.content?.trim()) {
            socket.emit("error", { message: "Invalid message payload" });
            return;
          }

          if (isRateLimited(userId)) {
            socket.emit("error", { message: "You are sending messages too quickly" });
            return;
          }

          const message = await ChatService.sendMessage(data.projectId, userId, {
            content: data.content.trim().slice(0, 2000),
            replyToId: data.replyToId,
          });

          io.to(`project:${data.projectId}`).emit("new_message", message);
        } catch (error: any) {
          socket.emit("error", { message: error.message || "Failed to send message" });
        }
      }
    );

    // Typing indicator
    socket.on("typing", (data: { projectId: string }) => {
      if (!data?.projectId) return;
      socket.to(`project:${data.projectId}`).emit("user_typing", {
        userId,
        userName: socket.user?.email,
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};
