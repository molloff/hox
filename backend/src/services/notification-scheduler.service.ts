import { supabaseAdmin } from '../config/supabase.js';
import { sendNotification } from './push.service.js';
import { listBills, getTrafficLight } from './bills.service.js';
import { listObligations } from './obligations.service.js';
import { checkExpiringDocuments } from './reminders.service.js';
import { computeScore } from './index-engine.service.js';
import { bus } from './bus.service.js';
import { logger } from '../utils/logger.js';
import type { MorningBriefing } from '../types/notifications.js';

/**
 * 09 — ИЗВЕСТЯВАНЕ
 * Push notification scheduler.
 * Runs as cron jobs at scheduled times.
 *
 * 13 notification categories from the master plan:
 * 1.  Електронен фиш (КАТ) — веднага при засичане
 * 2.  Акт от НАП — веднага + 14 дни преди срок
 * 3.  Имотен данък, такса смет, данък куче — 30 дни преди + при излизане
 * 4.  Сметка ток, вода, парно, интернет — 3 дни преди падеж
 * 5.  НАП данъци, осигуровки, НЗОК — 14-30 дни преди срок
 * 6.  ДДС декларация (фирми) — 14 дни преди срок
 * 7.  ГО застраховка, Каско, ГТП, винетка — 30 дни преди изтичане
 * 8.  Изтичащ наемен договор — 60 дни преди изтичане
 * 9.  Лична карта, паспорт, шофьорска — 90 дни преди изтичане
 * 10. Ваксинация на дете — 30 дни преди следваща ваксина
 * 11. Лекарства прием — в зададения час всеки ден
 * 12. Инкасо / ЧСИ дело (v2) — веднага при засичане
 * 13. Утринен брифинг — 07:30 всеки ден
 */

// ===== MORNING BRIEFING (07:30) =====

/**
 * Generate and send morning briefing to all users.
 * Runs daily at 07:30.
 */
export async function sendMorningBriefings(): Promise<void> {
  const { data: users } = await supabaseAdmin
    .from('notification_preferences')
    .select('user_id, briefing_time')
    .eq('morning_briefing', true);

  if (!users) return;

  let sent = 0;
  for (const userPref of users) {
    try {
      const briefing = await buildBriefing(userPref.user_id);
      if (!briefing) continue;

      const lines: string[] = [];
      if (briefing.overdueBills > 0) lines.push(`🔴 ${briefing.overdueBills} просрочени сметки`);
      if (briefing.unpaidBills > 0) lines.push(`🟡 ${briefing.unpaidBills} неплатени сметки`);
      if (briefing.upcomingObligations > 0) lines.push(`🏛 ${briefing.upcomingObligations} предстоящи задължения`);
      if (briefing.expiringDocuments > 0) lines.push(`📄 ${briefing.expiringDocuments} изтичащи документа`);
      if (briefing.pendingDeals > 0) lines.push(`🤝 ${briefing.pendingDeals} сделки чакат`);
      lines.push(`📊 HOX Score: ${briefing.hoxScore}%`);

      if (lines.length === 1 && briefing.hoxScore > 0) {
        // Only score, nothing urgent — skip
        continue;
      }

      await sendNotification({
        userId: userPref.user_id,
        category: 'morning_briefing',
        title: 'Добро утро от HOX ☀️',
        body: lines.join('\n'),
        priority: briefing.overdueBills > 0 ? 'high' : 'normal',
        data: { screen: 'Pay' },
      });
      sent++;
    } catch (err) {
      logger.error({ userId: userPref.user_id, err }, 'Morning briefing failed');
    }
  }

  logger.info({ sent }, 'Morning briefings sent');
}

async function buildBriefing(userId: string): Promise<MorningBriefing | null> {
  try {
    const [bills, obligations, expiring, score, deals] = await Promise.all([
      listBills(userId),
      listObligations(userId),
      checkExpiringDocuments(),
      computeScore(userId),
      supabaseAdmin
        .from('deals')
        .select('id')
        .or(`creator_id.eq.${userId},counterparty_id.eq.${userId}`)
        .in('status', ['draft', 'pending_signature', 'escrow_held'])
        .then((r) => r.data || []),
    ]);

    const unpaidBills = bills.filter((b: any) => b.status !== 'paid');
    const overdueBills = unpaidBills.filter((b: any) => b.traffic_light?.color === 'red');
    const unpaidObligations = obligations.filter((o: any) => o.status !== 'paid');
    const userExpiring = expiring.filter((d) => d.userId === userId);

    return {
      unpaidBills: unpaidBills.length,
      overdueBills: overdueBills.length,
      upcomingObligations: unpaidObligations.length,
      expiringDocuments: userExpiring.length,
      hoxScore: score.percentage,
      pendingDeals: deals.length,
    };
  } catch {
    return null;
  }
}

// ===== BILL REMINDERS =====

/**
 * Check bills approaching due date and send reminders.
 * Runs daily.
 */
export async function sendBillReminders(): Promise<void> {
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('is_verified', true);

  if (!users) return;

  let sent = 0;
  for (const user of users) {
    try {
      const bills = await listBills(user.id);

      for (const bill of bills) {
        if (bill.status === 'paid') continue;
        const light = bill.traffic_light;

        if (light.color === 'red') {
          await sendNotification({
            userId: user.id,
            category: 'bill_overdue',
            title: '🔴 Просрочена сметка!',
            body: `${bill.title} — ${bill.amount} ${bill.currency}. Плати веднага.`,
            priority: 'critical',
            data: { screen: 'Pay', billId: bill.id },
          });
          sent++;
        } else if (light.color === 'yellow') {
          await sendNotification({
            userId: user.id,
            category: 'bill_reminder',
            title: `🟡 Сметка до ${light.daysLeft} дни`,
            body: `${bill.title} — ${bill.amount} ${bill.currency}`,
            priority: 'high',
            data: { screen: 'Pay', billId: bill.id },
          });
          sent++;
        }
      }
    } catch (err) {
      logger.error({ userId: user.id, err }, 'Bill reminder failed');
    }
  }

  logger.info({ sent }, 'Bill reminders sent');
}

// ===== OBLIGATION ALERTS =====

/**
 * Send alerts for newly detected obligations.
 */
export async function sendObligationAlerts(): Promise<void> {
  // Get obligations created in the last 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: newObligations } = await supabaseAdmin
    .from('obligations')
    .select('*')
    .gte('created_at', since)
    .eq('status', 'pending');

  if (!newObligations) return;

  for (const obl of newObligations) {
    const isFine = obl.type === 'fine_kat' || obl.type === 'fine_other';

    await sendNotification({
      userId: obl.user_id,
      category: 'obligation_detected',
      title: isFine ? '🚨 Засечена глоба!' : '🏛 Ново задължение',
      body: `${obl.title} — ${obl.amount} ${obl.currency}${obl.due_date ? `. Срок: ${new Date(obl.due_date).toLocaleDateString('bg-BG')}` : ''}`,
      priority: isFine ? 'critical' : 'high',
      data: { screen: 'Pay', obligationId: obl.id },
    });
  }

  logger.info({ count: newObligations.length }, 'Obligation alerts sent');
}

// ===== DOCUMENT EXPIRY =====

/**
 * Send reminders for expiring documents in Vault.
 * Windows: 90d ID cards, 60d contracts, 30d warranties/insurance.
 */
export async function sendDocumentExpiryReminders(): Promise<void> {
  const reminders = await checkExpiringDocuments();

  for (const reminder of reminders) {
    let title: string;
    let priority: 'normal' | 'high' | 'critical' = 'normal';

    if (reminder.daysLeft <= 7) {
      title = `🔴 ${reminder.title} изтича след ${reminder.daysLeft} дни!`;
      priority = 'critical';
    } else if (reminder.daysLeft <= 30) {
      title = `🟡 ${reminder.title} изтича след ${reminder.daysLeft} дни`;
      priority = 'high';
    } else {
      title = `📄 ${reminder.title} изтича след ${reminder.daysLeft} дни`;
    }

    await sendNotification({
      userId: reminder.userId,
      category: 'document_expiry',
      title,
      body: `Провери в Vault и поднови навреме.`,
      priority,
      data: { screen: 'VaultFileDetail', fileId: reminder.fileId },
    });
  }

  logger.info({ count: reminders.length }, 'Document expiry reminders sent');
}

// ===== DEAL NOTIFICATIONS =====

// Register bus listeners for deal events
bus.on('deal_completed', async ({ dealId, userId }: { dealId: string; userId: string }) => {
  await sendNotification({
    userId,
    category: 'deal_completed',
    title: '✅ Сделка завършена!',
    body: 'Парите са освободени. Договорът е архивиран в Vault. Index +15%.',
    priority: 'high',
    data: { screen: 'DealDetail', dealId },
  });
});

bus.on('user_verified', async ({ userId }: { userId: string }) => {
  await sendNotification({
    userId,
    category: 'kyc_update',
    title: '✅ Верификацията е успешна!',
    body: 'Добре дошъл в HOX. Вече имаш достъп до всички модули.',
    priority: 'high',
    data: { screen: 'Profile' },
  });
});

// ===== CRON RUNNER =====

/**
 * Master cron function — called by external scheduler.
 * In production: use node-cron, AWS EventBridge, or Supabase Edge Functions.
 */
export async function runScheduledJobs(jobName: string): Promise<void> {
  logger.info({ jobName }, 'Running scheduled job');

  switch (jobName) {
    case 'morning_briefing':
      await sendMorningBriefings();
      break;
    case 'bill_reminders':
      await sendBillReminders();
      break;
    case 'obligation_alerts':
      await sendObligationAlerts();
      break;
    case 'document_expiry':
      await sendDocumentExpiryReminders();
      break;
    case 'nightly_all':
      // Run all daily jobs
      await sendBillReminders();
      await sendObligationAlerts();
      await sendDocumentExpiryReminders();
      break;
    default:
      logger.warn({ jobName }, 'Unknown job');
  }
}
