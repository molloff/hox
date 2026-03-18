import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import * as connectService from '../services/connect.service.js';

const router = Router();

// ===== SEARCH =====

// GET /connect/search?q=Електротехник
router.get('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    if (!q) { res.status(400).json({ error: 'Query required' }); return; }
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const results = await connectService.searchBySkill(q, limit, offset);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /connect/profile/:userId — public profile
router.get('/profile/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const profile = await connectService.getPublicProfile(req.params.userId);
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ===== KEY EXCHANGE =====

// POST /connect/keys/bundle — upload key bundle
router.post('/keys/bundle', authenticate, async (req: Request, res: Response) => {
  try {
    await connectService.upsertKeyBundle(req.user!.userId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload key bundle' });
  }
});

// POST /connect/keys/prekeys — upload one-time pre-keys
router.post('/keys/prekeys', authenticate, async (req: Request, res: Response) => {
  try {
    await connectService.uploadOneTimePrekeys(req.user!.userId, req.body.keys);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload pre-keys' });
  }
});

// GET /connect/keys/:userId — fetch key bundle for X3DH
router.get('/keys/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const bundle = await connectService.fetchKeyBundle(req.params.userId);
    res.json(bundle);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    res.status(404).json({ error: msg });
  }
});

// ===== CONVERSATIONS =====

// GET /connect/conversations — list conversations
router.get('/conversations', authenticate, async (req: Request, res: Response) => {
  try {
    const convos = await connectService.listConversations(req.user!.userId);
    res.json({ conversations: convos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// POST /connect/conversations — create or get conversation
router.post('/conversations', authenticate, async (req: Request, res: Response) => {
  try {
    const conversationId = await connectService.getOrCreateConversation(
      req.user!.userId,
      req.body.userId
    );
    res.json({ conversationId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /connect/conversations/:id/messages — get messages (ciphertext)
router.get('/conversations/:id/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string | undefined;
    const messages = await connectService.getMessages(req.params.id, limit, before);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// POST /connect/conversations/:id/messages — send encrypted message
router.post('/conversations/:id/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const msgId = await connectService.sendMessage(
      req.params.id,
      req.user!.userId,
      req.body.ciphertext,
      req.body.nonce,
      req.body.messageType || 'text',
      req.body.metadata || {}
    );
    res.json({ success: true, messageId: msgId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
