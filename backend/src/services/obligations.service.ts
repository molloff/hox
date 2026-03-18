import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { bus } from './bus.service.js';
import { logger } from '../utils/logger.js';
import type { ObligationType, BillSource } from '../types/pay.js';

/**
 * obligations.js — НАП API, КАТ API, pay.egov.bg
 * SEPARATE file from bills.js — handles government obligations only.
 *
 * Sources:
 * - НАП: income tax by ЕГН hash, self-employed insurance, VAT by ЕИК+ПИК
 * - КАТ: fines by reg. number
 * - pay.egov.bg: vehicle tax, property tax, dog tax, municipal
 */

interface ObligationInput {
  type: ObligationType;
  title: string;
  amount: number;
  source: BillSource;
  referenceId?: string;
  dueDate?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Check НАП obligations for a user.
 * Uses ЕГН hash — temporarily holds EGN in memory for the API request, then wipes.
 */
export async function checkNapObligations(userId: string): Promise<ObligationInput[]> {
  // In production: call НАП public API
  // POST nap.bg/api/obligations { egn_hash }
  // EGN is temporarily in memory for the request → deleted immediately
  //
  // Returns: income tax, social insurance, health insurance, VAT (if company)
  logger.info({ userId }, 'Checking НАП obligations');

  // Placeholder — real implementation calls НАП API
  return [];
}

/**
 * Check КАТ fines by registration number.
 */
export async function checkKatFines(userId: string, regNumber: string): Promise<ObligationInput[]> {
  // In production: call pay.egov.bg API
  // GET pay.egov.bg/api/kat/fines?reg={regNumber}
  logger.info({ userId, regNumber }, 'Checking КАТ fines');

  return [];
}

/**
 * Check municipal obligations via pay.egov.bg.
 * Vehicle tax, property tax, dog tax.
 */
export async function checkMunicipalObligations(userId: string): Promise<ObligationInput[]> {
  // In production: call pay.egov.bg API for each obligation type
  logger.info({ userId }, 'Checking municipal obligations');

  return [];
}

/**
 * Sync all obligations for a user.
 * Called periodically and on-demand.
 */
export async function syncObligations(userId: string): Promise<number> {
  const allObligations: ObligationInput[] = [];

  try {
    const [nap, kat, municipal] = await Promise.allSettled([
      checkNapObligations(userId),
      checkKatFines(userId, ''), // needs reg number from user profile
      checkMunicipalObligations(userId),
    ]);

    if (nap.status === 'fulfilled') allObligations.push(...nap.value);
    if (kat.status === 'fulfilled') allObligations.push(...kat.value);
    if (municipal.status === 'fulfilled') allObligations.push(...municipal.value);
  } catch (err) {
    logger.error({ userId, err }, 'Obligation sync partial failure');
  }

  // Upsert obligations (avoid duplicates by reference_id)
  let inserted = 0;
  for (const obl of allObligations) {
    if (obl.referenceId) {
      const { data: existing } = await supabaseAdmin
        .from('obligations')
        .select('id')
        .eq('user_id', userId)
        .eq('reference_id', obl.referenceId)
        .single();

      if (existing) continue; // Already tracked
    }

    await supabaseAdmin.from('obligations').insert({
      user_id: userId,
      type: obl.type,
      title: obl.title,
      amount: obl.amount,
      source: obl.source,
      reference_id: obl.referenceId || null,
      due_date: obl.dueDate || null,
      status: 'pending',
      metadata: obl.metadata || {},
    });
    inserted++;
  }

  logger.info({ userId, total: allObligations.length, inserted }, 'Obligations synced');
  return inserted;
}

/**
 * Mark an obligation as paid.
 * НАП/КАТ payments carry higher index weight (official 3.0×).
 */
export async function markObligationPaid(
  userId: string,
  obligationId: string,
  paidVia: string
): Promise<void> {
  const { data: obl } = await supabaseAdmin
    .from('obligations')
    .select('*')
    .eq('id', obligationId)
    .eq('user_id', userId)
    .single();

  if (!obl) throw new Error('Obligation not found');

  const now = new Date();
  const dueDate = obl.due_date ? new Date(obl.due_date) : null;
  const isOnTime = !dueDate || now <= dueDate;

  // Official source weight: 3.0×
  // КАТ fine detected: -3 points
  // Paid on time: +2 per week cap
  let indexPoints = 0;
  if (obl.type === 'fine_kat') {
    indexPoints = isOnTime ? 1 : -3;
  } else {
    indexPoints = isOnTime ? (obl.amount > 500 ? 3 : 2) : -2;
  }

  await supabaseAdmin
    .from('obligations')
    .update({
      status: 'paid',
      paid_at: now.toISOString(),
      paid_via: paidVia,
      index_points: indexPoints,
    })
    .eq('id', obligationId);

  bus.emit('bill_paid', { userId, obligationId, indexPoints, source: 'official' });

  logger.info({ userId, obligationId, type: obl.type, indexPoints }, 'Obligation paid');
}

/**
 * List all obligations for a user.
 */
export async function listObligations(userId: string): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('obligations')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return data || [];
}
