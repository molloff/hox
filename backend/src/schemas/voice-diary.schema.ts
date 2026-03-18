import { z } from 'zod';

export const uploadVoiceSchema = z.object({
  body: z.object({
    audioBase64: z.string().min(1),
    durationMs: z.coerce.number().positive(),
    mimeType: z.string().default('audio/m4a'),
  }),
});

export const askDiarySchema = z.object({
  body: z.object({
    question: z.string().min(1).max(2000),
  }),
});
