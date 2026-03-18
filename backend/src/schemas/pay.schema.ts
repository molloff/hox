import { z } from 'zod';

export const createBillSchema = z.object({
  body: z.object({
    provider: z.string().min(1),
    title: z.string().min(1).max(200),
    amount: z.coerce.number().positive(),
    dueDate: z.string().date().optional(),
    source: z.enum(['epay', 'gmail', 'nordigen', 'manual']).default('manual'),
    merchantId: z.string().optional(),
    clientId: z.string().optional(),
  }),
});

export const payBillSchema = z.object({
  body: z.object({
    biometricConfirmed: z.boolean(),
  }),
});

export const createDealSchema = z.object({
  body: z.object({
    counterpartyId: z.string().uuid().optional(),
    template: z.enum(['rent', 'service', 'nda', 'sale', 'protocol', 'offer', 'custom']),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    amount: z.coerce.number().positive().optional(),
    currency: z.string().length(3).default('BGN'),
  }),
});

export const disputeDealSchema = z.object({
  body: z.object({
    reason: z.string().min(1).max(1000),
  }),
});
