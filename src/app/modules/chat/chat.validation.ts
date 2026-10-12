import { z } from "zod";

export const sendMessageSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
    replyToId: z.string().optional(),
    attachments: z.array(z.string().url()).optional(),
  }),
});

export const ChatValidation = {
  sendMessageSchema,
};