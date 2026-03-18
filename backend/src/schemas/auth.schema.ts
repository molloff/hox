import { z } from 'zod';

const bgPhoneRegex = /^\+359[89]\d{8}$/;

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(bgPhoneRegex, 'Must be a valid Bulgarian mobile number (+359XXXXXXXXX)'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(bgPhoneRegex, 'Must be a valid Bulgarian mobile number (+359XXXXXXXXX)'),
    code: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/),
  }),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>['body'];
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>['body'];
