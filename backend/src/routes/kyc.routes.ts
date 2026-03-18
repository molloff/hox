import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { startKycSchema } from '../schemas/kyc.schema.js';
import * as kycService from '../services/kyc.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// POST /kyc/start — requires authenticated user
router.post('/start', authenticate, validate(startKycSchema), async (req: Request, res: Response) => {
  try {
    const result = await kycService.startKyc(
      req.user!.userId,
      req.body.firstName,
      req.body.lastName
    );
    res.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'KYC start failed';
    res.status(500).json({ error: message });
  }
});

// GET /kyc/status — requires authenticated user
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const status = await kycService.getKycStatus(req.user!.userId);
    res.json({ kyc_status: status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get KYC status' });
  }
});

// POST /kyc/webhook — called by Onfido, verified by HMAC
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-sha2-signature'] as string;
    if (!signature || !req.rawBody) {
      res.status(400).json({ error: 'Missing signature or body' });
      return;
    }

    if (!kycService.verifyWebhookSignature(req.rawBody, signature)) {
      logger.warn('Invalid Onfido webhook signature');
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    const { payload } = req.body;
    if (payload?.resource_type === 'check' && payload?.action === 'check.completed') {
      await kycService.handleWebhook(payload.object.id);
    }

    res.json({ success: true });
  } catch (err) {
    logger.error(err, 'Webhook processing error');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
