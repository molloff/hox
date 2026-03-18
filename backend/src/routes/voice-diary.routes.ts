import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { uploadVoiceSchema, askDiarySchema } from '../schemas/voice-diary.schema.js';
import * as voiceDiary from '../services/voice-diary.service.js';
import * as tts from '../services/tts.service.js';

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

// POST /diary/ask — ask AI about diary (text response)
router.post('/ask', authenticate, validate(askDiarySchema), async (req: Request, res: Response) => {
  try {
    const answer = await voiceDiary.askDiary(req.user!.userId, req.body.question);
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: 'AI query failed' });
  }
});

// POST /diary/ask-voice — ask AI about diary, get voice response
router.post('/ask-voice', authenticate, validate(askDiarySchema), async (req: Request, res: Response) => {
  try {
    const answer = await voiceDiary.askDiary(req.user!.userId, req.body.question);
    const voice = (req.body.voice || 'nova') as tts.TtsVoice;
    const audio = await tts.synthesizeDiaryResponse(answer, voice);

    res.json({
      answer,
      audioBase64: audio.toString('base64'),
      audioMimeType: 'audio/mpeg',
    });
  } catch (err) {
    res.status(500).json({ error: 'Voice response failed' });
  }
});

// POST /diary/entries/:id/read-aloud — TTS for a diary entry summary
router.post('/entries/:id/read-aloud', authenticate, async (req: Request, res: Response) => {
  try {
    const entry = await voiceDiary.getEntry(req.user!.userId, req.params.id);
    const text = entry.ai_summary || entry.transcript || '';
    if (!text) { res.status(400).json({ error: 'No text to read' }); return; }

    const voice = (req.body?.voice || 'nova') as tts.TtsVoice;
    const audio = await tts.synthesizeSpeech(text, voice);

    res.json({
      text,
      audioBase64: audio.toString('base64'),
      audioMimeType: 'audio/mpeg',
    });
  } catch (err) {
    res.status(500).json({ error: 'TTS failed' });
  }
});

// POST /diary/tts — generic TTS endpoint
router.post('/tts', authenticate, async (req: Request, res: Response) => {
  try {
    const { text, voice = 'nova', speed = 1.0 } = req.body;
    if (!text) { res.status(400).json({ error: 'Text required' }); return; }

    const audio = await tts.synthesizeSpeech(text, voice as tts.TtsVoice, speed);

    res.json({
      audioBase64: audio.toString('base64'),
      audioMimeType: 'audio/mpeg',
    });
  } catch (err) {
    res.status(500).json({ error: 'TTS failed' });
  }
});

export default router;
