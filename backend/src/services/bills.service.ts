import { supabaseAdmin } from '../config/supabase.js';
import { bus } from './bus.service.js';
import { logger } from '../utils/logger.js';
import type { TrafficLight } from '../types/pay.js';

/**
 * bills.js — manages utility bills (ePay, Gmail parsed, manual).
 * INSERT into bills table when a bill is detected.
 * Handles: provider, amount, due_date, status, source.
 */

export async function createBill(userId: string, bill: {
  provider: string;
  title: string;
  amount: number;
  currency?: string;
  dueDate?: string;
  source: string;
  merchantId?: string;
  clientId?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('bills')
    .insert({
      user_id: userId,
      provider: bill.provider,
      title: bill.title,
      amount: bill.amount,
      currency: bill.currency || 'BGN',
      due_date: bill.dueDate || null,
      source: bill.source,
      merchant_id: bill.merchantId || null,
      client_id: bill.clientId || null,
      status: 'pending',
      metadata: bill.metadata || {},
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`Failed to create bill: ${error?.message}`);

  logger.info({ userId, billId: data.id, provider: bill.provider }, 'Bill created');
  return data.id;
}

/**
 * Mark a bill as paid via ePay or bank.
 * Calculates index points using Cap formula.
 */
export async function markBillPaid(userId: string, billId: string, paidVia: string): Promise<void> {
  const { data: bill } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('id', billId)
    .eq('user_id', userId)
    .single();

  if (!bill) throw new Error('Bill not found');

  const now = new Date();
  const dueDate = bill.due_date ? new Date(bill.due_date) : null;
  const isOnTime = !dueDate || now <= dueDate;

  // Cap formula: weight × cap
  // bill_paid_ontime via ePay/bank = official 1.0× → +1/day max
  // bill_paid_ontime manual = self 0.3× → +0.3/day
  // bill_overdue = official 1.0× → -2 no cap
  let indexPoints = 0;
  if (isOnTime) {
    const weight = (paidVia === 'manual') ? 0.3 : 1.0;
    indexPoints = weight; // Cap enforced by index-engine at EOD
  } else {
    indexPoints = -2; // Overdue penalty — no cap
  }

  await supabaseAdmin
    .from('bills')
    .update({
      status: 'paid',
      paid_at: now.toISOString(),
      paid_via: paidVia,
      index_points: indexPoints,
    })
    .eq('id', billId);

  // Log event
  await supabaseAdmin.from('events').insert({
    user_id: userId,
    type: 'profile_updated', // reuse — or add bill_paid event type
    payload: { bill_id: billId, paid_via: paidVia, on_time: isOnTime, index_points: indexPoints },
  });

  bus.emit('bill_paid', { userId, billId, indexPoints });

  logger.info({ userId, billId, paidVia, isOnTime, indexPoints }, 'Bill marked as paid');
}

/**
 * Get traffic light color for a bill.
 * Green: >7 days | Yellow: 1-7 days | Red: 0 or overdue | Grey: paid
 */
export function getTrafficLight(status: string, dueDate: string | null): TrafficLight {
  if (status === 'paid') return { color: 'grey', daysLeft: null };

  if (!dueDate) return { color: 'green', daysLeft: null };

  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (86400000));

  if (days < 0) return { color: 'red', daysLeft: days };
  if (days <= 7) return { color: 'yellow', daysLeft: days };
  return { color: 'green', daysLeft: days };
}

/**
 * List bills for a user with traffic light status.
 */
export async function listBills(userId: string): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data || []).map((bill: any) => ({
    ...bill,
    traffic_light: getTrafficLight(bill.status, bill.due_date),
  }));
}
