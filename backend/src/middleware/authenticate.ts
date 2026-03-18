import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const { data: userRow, error: dbError } = await supabaseAdmin
      .from('users')
      .select('id, phone, is_verified')
      .eq('auth_id', authUser.id)
      .single();

    if (dbError || !userRow) {
      res.status(403).json({ error: 'User profile not found' });
      return;
    }

    req.user = {
      authId: authUser.id,
      userId: userRow.id,
      phone: userRow.phone,
      isVerified: userRow.is_verified,
    };

    next();
  } catch (err) {
    logger.error(err, 'Authentication error');
    res.status(500).json({ error: 'Authentication failed' });
  }
}
