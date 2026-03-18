import { Router, type Request, type Response } from 'express';
import { validate } from '../middleware/validate.js';
import { otpLimiter } from '../middleware/rateLimit.js';
import { sendOtpSchema, verifyOtpSchema } from '../schemas/auth.schema.js';
import * as authService from '../services/auth.service.js';

const router = Router();

// POST /auth/otp/send
router.post('/otp/send', otpLimiter, validate(sendOtpSchema), async (req: Request, res: Response) => {
  try {
    await authService.sendOtp(req.body.phone);
    res.json({ success: true, message: 'OTP sent' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send OTP';
    res.status(500).json({ error: message });
  }
});

// POST /auth/otp/verify
router.post('/otp/verify', otpLimiter, validate(verifyOtpSchema), async (req: Request, res: Response) => {
  try {
    const result = await authService.verifyOtp(req.body.phone, req.body.code);
    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.user.id,
        phone: result.user.phone,
        kyc_status: result.user.kyc_status,
        is_verified: result.user.is_verified,
        profile_type: result.user.profile_type,
      },
      isNewUser: result.isNewUser,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    res.status(401).json({ error: message });
  }
});

export default router;
