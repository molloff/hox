import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Check for expiring vault documents and generate reminders.
 * Run as a cron job (daily at 07:30).
 *
 * Reminder windows:
 * - ID card, passport, driver's license: 90 days before
 * - Rental contracts: 60 days before
 * - Insurance (GO, Каско), ГТП, винетка: 30 days before
 * - Warranties: 30 days before
 */
export async function checkExpiringDocuments(): Promise<{ userId: string; fileId: string; title: string; daysLeft: number }[]> {
  const reminders: { userId: string; fileId: string; title: string; daysLeft: number }[] = [];

  // Documents expiring within 90 days
  const { data: expiring } = await supabaseAdmin
    .from('vault_files')
    .select('id, user_id, title, category, expires_at')
    .not('expires_at', 'is', null)
    .gte('expires_at', new Date().toISOString().split('T')[0])
    .lte('expires_at', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('expires_at', { ascending: true });

  if (!expiring) return reminders;

  for (const doc of expiring) {
    const daysLeft = Math.ceil(
      (new Date(doc.expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    // Check reminder window based on category
    let shouldRemind = false;
    if (doc.category === 'documents' && daysLeft <= 90) shouldRemind = true;
    else if (doc.category === 'contracts' && daysLeft <= 60) shouldRemind = true;
    else if (doc.category === 'warranties' && daysLeft <= 30) shouldRemind = true;
    else if (daysLeft <= 30) shouldRemind = true;

    if (shouldRemind) {
      reminders.push({
        userId: doc.user_id,
        fileId: doc.id,
        title: doc.title,
        daysLeft,
      });
    }
  }

  logger.info({ count: reminders.length }, 'Expiry reminders generated');
  return reminders;
}
