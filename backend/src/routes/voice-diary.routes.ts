import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { uploadVoiceSchema, askDiarySchema } from '../schemas/voice-diary.schema.js';
import * as voiceDiary from '../services/voice-diary.service.js';

const router = Router();

// POST /diary/voice — upload and process voice entry
router.post('/voice', authenticate, validate(uploadVoiceSchema), async (req: Request, res: Response) => {
  try {
    const result = await voiceDiary.processVoiceEntry(
      req.user!.userId,
      req.body.audioBase64,
      req.body.durationMs,
      req.body.mimeType
    );
    res.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Processing failed';
    res.status(500).json({ error: msg });
  }
});

// GET /diary/entries — list diary entries
router.get('/entries', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const entries = await voiceDiary.listEntries(req.user!.userId, limit);
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list entries' });
  }
});

// GET /diary/entries/:id — get single entry
router.get('/entries/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const entry = await voiceDiary.getEntry(req.user!.userId, req.params.id);
    res.json(entry);
  } catch (err) {
    res.status(404).json({ error: 'Entry not found' });
  }
});

// POST /diary/ask — ask AI about diary
router.post('/ask', authenticate, validate(askDiarySchema), async (req: Request, res: Response) => {
  try {
    const answer = await voiceDiary.askDiary(req.user!.userId, req.body.question);
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: 'AI query failed' });
  }
});

export default router;
