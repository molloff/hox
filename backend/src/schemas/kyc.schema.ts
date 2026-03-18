import { z } from 'zod';

export const startKycSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
  }),
});

export const onfidoWebhookPayloadSchema = z.object({
  payload: z.object({
    resource_type: z.string(),
    action: z.string(),
    object: z.object({
      id: z.string(),
      status: z.string().optional(),
      completed_at_iso8601: z.string().optional(),
      href: z.string().optional(),
    }),
  }),
});

export type StartKycInput = z.infer<typeof startKycSchema>['body'];
