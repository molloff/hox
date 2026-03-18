import { z } from 'zod';

export const chatMessageSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(4000),
    conversationId: z.string().uuid().optional(),
  }),
});

export const quickActionSchema = z.object({
  body: z.object({
    prompt: z.string().min(1).max(2000),
  }),
});
