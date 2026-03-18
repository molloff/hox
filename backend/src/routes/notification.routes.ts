import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { registerTokenSchema, updatePreferencesSchema, runJobSchema } from '../schemas/notification.schema.js';
import * as pushService from '../services/push.service.js';
import * as scheduler from '../services/notification-scheduler.service.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

// POST /notifications/token — register push token
router.post('/token', authenticate, validate(registerTokenSchema), async (req: Request, res: Response) => {
  try {
    await pushService.registerToken(req.user!.userId, req.body.token, req.body.platform);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed';
    res.status(400).json({ error: msg });
  }
});

// DELETE /notifications/token — unregister push token
router.delete('/token', authenticate, async (req: Request, res: Response) => {
  try {
    await pushService.unregisterToken(req.user!.userId, req.body.token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unregister token' });
  }
});

// GET /notifications — list user's notifications
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unread === 'true';

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user!.userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ notifications: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list notifications' });
  }
});

// GET /notifications/unread-count
router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const { count } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user!.userId)
      .eq('read', false);

    res.json({ count: count || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to count' });
  }
});

// POST /notifications/:id/read — mark as read
router.post('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('user_id', req.user!.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /notifications/read-all — mark all as read
router.post('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', req.user!.userId)
      .eq('read', false);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /notifications/preferences
router.get('/preferences', authenticate, async (req: Request, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('user_id', req.user!.userId)
      .single();

    if (!data) {
      // Create default preferences
      const { data: created } = await supabaseAdmin
        .from('notification_preferences')
        .insert({ user_id: req.user!.userId })
        .select('*')
        .single();
      res.json(created);
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

// PATCH /notifications/preferences
router.patch('/preferences', authenticate, validate(updatePreferencesSchema), async (req: Request, res: Response) => {
  try {
    const { data } = await supabaseAdmin
      .from('notification_preferences')
      .upsert({ user_id: req.user!.userId, ...req.body })
      .select('*')
      .single();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// POST /notifications/cron — trigger scheduled job (admin/cron endpoint)
router.post('/cron', validate(runJobSchema), async (req: Request, res: Response) => {
  try {
    await scheduler.runScheduledJobs(req.body.job);
    res.json({ success: true, job: req.body.job });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Job failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
