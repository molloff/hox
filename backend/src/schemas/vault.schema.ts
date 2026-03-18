import { z } from 'zod';

const vaultCategories = [
  'documents', 'receipts', 'warranties', 'health',
  'children', 'pets', 'diary', 'contracts', 'certificates',
] as const;

export const uploadFileSchema = z.object({
  body: z.object({
    category: z.enum(vaultCategories),
    title: z.string().min(1).max(200),
    expiresAt: z.string().date().optional(),
  }),
});

export const searchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(500),
  }),
});

export const createShareSchema = z.object({
  body: z.object({
    fileId: z.string().uuid(),
    expiresInMinutes: z.coerce.number().min(1).max(43200).default(10), // max 30 days
    maxViews: z.coerce.number().min(1).max(100).default(1),
    scope: z.array(z.string()).default(['read']),
  }),
});

export const listFilesSchema = z.object({
  query: z.object({
    category: z.enum(vaultCategories).optional(),
  }),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>['body'];
export type CreateShareInput = z.infer<typeof createShareSchema>['body'];
