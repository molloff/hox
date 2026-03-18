import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createDealSchema, disputeDealSchema } from '../schemas/pay.schema.js';
import * as dealService from '../services/deal.service.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /deal — list user's deals
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const deals = await dealService.listDeals(req.user!.userId);
    res.json({ deals });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list deals' });
  }
});

// POST /deal — create new deal
router.post('/', authenticate, validate(createDealSchema), async (req: Request, res: Response) => {
  try {
    const deal = await dealService.createDeal({
      creatorId: req.user!.userId,
      counterpartyId: req.body.counterpartyId,
      template: req.body.template,
      title: req.body.title,
      description: req.body.description,
      amount: req.body.amount,
      currency: req.body.currency,
    });
    res.json({ success: true, deal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    res.status(500).json({ error: msg });
  }
});

// GET /deal/:id — get deal details + event history
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await dealService.getDeal(req.params.id, req.user!.userId);
    res.json(result);
  } catch (err) {
    res.status(404).json({ error: 'Deal not found' });
  }
});

// POST /deal/:id/escrow — create Stripe escrow
router.post('/:id/escrow', authenticate, async (req: Request, res: Response) => {
  try {
    const clientSecret = await dealService.createEscrow(req.params.id);
    res.json({ success: true, clientSecret });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Escrow failed';
    res.status(500).json({ error: msg });
  }
});

// POST /deal/:id/sign — sign the deal
router.post('/:id/sign', authenticate, async (req: Request, res: Response) => {
  try {
    await dealService.signDeal(req.params.id, req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signing failed';
    res.status(500).json({ error: msg });
  }
});

// POST /deal/:id/complete — confirm completion, capture escrow
router.post('/:id/complete', authenticate, async (req: Request, res: Response) => {
  try {
    await dealService.completeDeal(req.params.id, req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Completion failed';
    res.status(500).json({ error: msg });
  }
});

// POST /deal/:id/dispute — dispute and refund
router.post('/:id/dispute', authenticate, validate(disputeDealSchema), async (req: Request, res: Response) => {
  try {
    await dealService.disputeDeal(req.params.id, req.user!.userId, req.body.reason);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dispute failed';
    res.status(500).json({ error: msg });
  }
});

// GET /deal/:id/contract — generate contract text
router.get('/:id/contract', authenticate, async (req: Request, res: Response) => {
  try {
    const contract = await dealService.generateContract(req.params.id);
    res.json({ contract });
  } catch (err) {
    res.status(500).json({ error: 'Contract generation failed' });
  }
});

// POST /deal/stripe-webhook — Stripe webhook handler
router.post('/stripe-webhook', async (req: Request, res: Response) => {
  // In production: verify Stripe webhook signature
  // stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  const event = req.body;

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    logger.info({ piId: pi.id }, 'Stripe payment succeeded');
  }

  res.json({ received: true });
});

export default router;
