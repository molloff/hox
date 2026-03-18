import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { createBillSchema, payBillSchema } from '../schemas/pay.schema.js';
import * as billsService from '../services/bills.service.js';
import * as obligationsService from '../services/obligations.service.js';
import * as payRouter from '../services/pay-router.service.js';
import * as gmailService from '../services/gmail.service.js';

const router = Router();

// GET /pay/dashboard — unified bills + obligations view
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const dashboard = await payRouter.getPaymentDashboard(req.user!.userId);
    res.json(dashboard);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// GET /pay/bills — list utility bills
router.get('/bills', authenticate, async (req: Request, res: Response) => {
  try {
    const bills = await billsService.listBills(req.user!.userId);
    res.json({ bills });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list bills' });
  }
});

// POST /pay/bills — create manual bill
router.post('/bills', authenticate, validate(createBillSchema), async (req: Request, res: Response) => {
  try {
    const id = await billsService.createBill(req.user!.userId, req.body);
    res.json({ success: true, billId: id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    res.status(500).json({ error: msg });
  }
});

// POST /pay/bills/:id/pay — pay a bill
router.post('/bills/:id/pay', authenticate, validate(payBillSchema), async (req: Request, res: Response) => {
  try {
    const result = await payRouter.processPayment({
      userId: req.user!.userId,
      targetType: 'bill',
      targetId: req.params.id,
      amount: 0, // determined from bill record
      biometricConfirmed: req.body.biometricConfirmed,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment failed';
    res.status(500).json({ error: msg });
  }
});

// GET /pay/obligations — list government obligations
router.get('/obligations', authenticate, async (req: Request, res: Response) => {
  try {
    const obligations = await obligationsService.listObligations(req.user!.userId);
    res.json({ obligations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list obligations' });
  }
});

// POST /pay/obligations/sync — check all government APIs
router.post('/obligations/sync', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await obligationsService.syncObligations(req.user!.userId);
    res.json({ success: true, newObligations: count });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// POST /pay/obligations/:id/pay
router.post('/obligations/:id/pay', authenticate, validate(payBillSchema), async (req: Request, res: Response) => {
  try {
    const result = await payRouter.processPayment({
      userId: req.user!.userId,
      targetType: 'obligation',
      targetId: req.params.id,
      amount: 0,
      biometricConfirmed: req.body.biometricConfirmed,
    });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Payment failed';
    res.status(500).json({ error: msg });
  }
});

// GET /pay/gmail/auth — get Gmail OAuth URL
router.get('/gmail/auth', authenticate, (_req: Request, res: Response) => {
  const url = gmailService.getGmailAuthUrl();
  res.json({ url });
});

// POST /pay/gmail/callback — exchange OAuth code
router.post('/gmail/callback', authenticate, async (req: Request, res: Response) => {
  try {
    await gmailService.exchangeGmailCode(req.user!.userId, req.body.code);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gmail connection failed' });
  }
});

// POST /pay/gmail/scan — scan for bills
router.post('/gmail/scan', authenticate, async (req: Request, res: Response) => {
  try {
    const count = await gmailService.scanGmailForBills(req.user!.userId);
    res.json({ success: true, billsFound: count });
  } catch (err) {
    res.status(500).json({ error: 'Gmail scan failed' });
  }
});

export default router;
