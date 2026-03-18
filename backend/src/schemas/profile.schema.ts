import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    profile_type: z.enum(['family', 'freelancer', 'small_business']).optional(),
    display_name: z.string().max(100).optional(),
    skills: z.array(z.string().max(50)).max(20).optional(),
    description: z.string().max(500).optional(),
    company_name: z.string().max(200).optional().nullable(),
    eik: z.string().max(20).optional().nullable(),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
