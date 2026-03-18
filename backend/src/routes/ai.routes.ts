import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { chatMessageSchema, quickActionSchema } from '../schemas/ai.schema.js';
import * as aiChat from '../services/ai-chat.service.js';

const router = Router();

// POST /ai/chat — send message to HOX AI
router.post('/chat', authenticate, validate(chatMessageSchema), async (req: Request, res: Response) => {
  try {
    let conversationId = req.body.conversationId;

    if (!conversationId) {
      conversationId = await aiChat.createConversation(req.user!.userId);
    }

    const result = await aiChat.chat(req.user!.userId, conversationId, req.body.message);

    res.json({
      response: result.response,
      conversationId: result.conversationId,
      toolsUsed: result.toolsUsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI chat failed';
    res.status(500).json({ error: msg });
  }
});

// POST /ai/quick — single question, no conversation
router.post('/quick', authenticate, validate(quickActionSchema), async (req: Request, res: Response) => {
  try {
    const response = await aiChat.quickAction(req.user!.userId, req.body.prompt);
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: 'AI action failed' });
  }
});

// GET /ai/conversations — list conversations
router.get('/conversations', authenticate, async (req: Request, res: Response) => {
  try {
    const conversations = await aiChat.listConversations(req.user!.userId);
    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// GET /ai/conversations/:id/messages — get messages
router.get('/conversations/:id/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const messages = await aiChat.getConversationMessages(req.params.id);
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// DELETE /ai/conversations/:id — delete conversation
router.delete('/conversations/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await aiChat.deleteConversation(req.user!.userId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
