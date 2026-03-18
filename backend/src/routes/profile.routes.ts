import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { updateProfileSchema } from '../schemas/profile.schema.js';
import * as profileService from '../services/profile.service.js';

const router = Router();

// GET /profile
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const profile = await profileService.getProfile(req.user!.userId);
    res.json({
      id: profile.id,
      phone: profile.phone,
      kyc_status: profile.kyc_status,
      is_verified: profile.is_verified,
      profile_type: profile.profile_type,
      display_name: profile.display_name,
      skills: profile.skills,
      description: profile.description,
      company_name: profile.company_name,
      eik: profile.eik,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });
  } catch (err) {
    res.status(404).json({ error: 'Profile not found' });
  }
});

// PATCH /profile
router.patch('/', authenticate, validate(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const updated = await profileService.updateProfile(req.user!.userId, req.body);
    res.json({
      id: updated.id,
      profile_type: updated.profile_type,
      display_name: updated.display_name,
      skills: updated.skills,
      description: updated.description,
      company_name: updated.company_name,
      eik: updated.eik,
      updated_at: updated.updated_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    res.status(500).json({ error: message });
  }
});

export default router;
