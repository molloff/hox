import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as indexEngine from '../services/index-engine.service.js';
import * as creditReport from '../services/credit-report.service.js';

const router = Router();

// GET /index/score — compute score on-the-fly
router.get('/score', authenticate, async (req: Request, res: Response) => {
  try {
    const score = await indexEngine.computeScore(req.user!.userId);
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute score' });
  }
});

// GET /index/events — list index events
router.get('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { data } = await (await import('../config/supabase.js')).supabaseAdmin
      .from('index_events')
      .select('*')
      .eq('user_id', req.user!.userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    res.json({ events: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list events' });
  }
});

// GET /index/breakdown — pillar breakdown
router.get('/breakdown', authenticate, async (req: Request, res: Response) => {
  try {
    const score = await indexEngine.computeScore(req.user!.userId);
    res.json({
      percentage: score.percentage,
      total: score.total,
      pillars: score.pillars.map((p) => ({
        name: p.pillar,
        weight: `${(p.weight * 100).toFixed(0)}%`,
        rawScore: p.rawScore,
        weighted: p.weightedScore,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get breakdown' });
  }
});

// POST /index/ckr — process ЦКР PDF
router.post('/ckr', authenticate, async (req: Request, res: Response) => {
  try {
    await creditReport.processCkrPdf(
      req.user!.userId,
      req.body.ocrText,
      req.body.signatureValid
    );
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
