import type { Server, Socket } from "socket.io";
import { ChatService } from "./chat.service.js";
import { prisma } from "../../shared/prisma.js";

export const registerChatGateway = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join project room
    socket.on("join_project", async (projectId: string) => {
      socket.join(`project:${projectId}`);
      console.log(`Socket ${socket.id} joined project:${projectId}`);
    });

    // Leave project room
    socket.on("leave_project", (projectId: string) => {
      socket.leave(`project:${projectId}`);
    });

    // Send message via socket
    socket.on("send_message", async (data: {
      projectId: string;
      content: string;
      replyToId?: string;
      tokenUserId: string; // from auth
    }) => {
      try {
        const message = await ChatService.sendMessage(
          data.projectId,
          data.tokenUserId,
          {
            content: data.content,
            replyToId: data.replyToId,
          }
        );

        // Broadcast to everyone in the project room
        io.to(`project:${data.projectId}`).emit("new_message", message);
      } catch (error: any) {
        socket.emit("error", { message: error.message });
      }
    });

    // Typing indicator
    socket.on("typing", (data: { projectId: string; userName: string }) => {
      socket.to(`project:${data.projectId}`).emit("user_typing", {
        userName: data.userName,
      });
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};