import { randomBytes } from 'node:crypto';
import { stripe } from '../config/stripe.js';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { bus } from './bus.service.js';
import { logger } from '../utils/logger.js';
import type { DealTemplate, SignatureType, DealRow } from '../types/pay.js';

/**
 * Deal module — contracts with escrow and e-signatures.
 *
 * Flow:
 * 1. Creator drafts deal (template + terms)
 * 2. HOX generates contract from template
 * 3. Both parties sign (simple or КЕП via Evrotrust)
 * 4. Money held in Stripe escrow (delayed capture)
 * 5. Work completed → both confirm → capture payment
 * 6. Contract archived in Vault → Index +15% for both
 *
 * AML: €5,000 limit per deal — one line of code.
 */

interface CreateDealInput {
  creatorId: string;
  counterpartyId?: string;
  template: DealTemplate;
  title: string;
  description?: string;
  amount?: number;
  currency?: string;
}

/**
 * Determine signature type based on amount.
 * Under €1,000 = simple signature
 * Over €1,000 or rent/sale/NDA = КЕП (qualified electronic signature)
 */
function resolveSignatureType(template: DealTemplate, amount?: number): SignatureType {
  // КЕП always required for these
  if (['rent', 'sale', 'nda'].includes(template)) return 'kep';

  // Amount threshold: €1,000 ≈ 1,955 BGN
  if (amount && amount > 1955) return 'kep';

  return 'simple';
}

/**
 * Create a new deal.
 */
export async function createDeal(input: CreateDealInput): Promise<DealRow> {
  // AML check — €5,000 limit
  if (input.amount && input.amount > env.AML_DEAL_LIMIT_EUR * 1.955) {
    throw new Error(`Deal amount exceeds AML limit of €${env.AML_DEAL_LIMIT_EUR}`);
  }

  const signatureType = resolveSignatureType(input.template, input.amount);
  const idempotencyKey = randomBytes(16).toString('hex');

  const { data: deal, error } = await supabaseAdmin
    .from('deals')
    .insert({
      creator_id: input.creatorId,
      counterparty_id: input.counterpartyId || null,
      template: input.template,
      title: input.title,
      description: input.description || '',
      amount: input.amount || null,
      currency: input.currency || 'BGN',
      signature_type: signatureType,
      status: 'draft',
      idempotency_key: idempotencyKey,
    })
    .select('*')
    .single();

  if (error || !deal) throw new Error(`Failed to create deal: ${error?.message}`);

  // Log event
  await supabaseAdmin.from('deal_events').insert({
    deal_id: deal.id,
    actor_id: input.creatorId,
    action: 'deal_created',
    payload: { template: input.template, signature_type: signatureType },
  });

  logger.info({ dealId: deal.id, template: input.template, signatureType }, 'Deal created');
  return deal as DealRow;
}

/**
 * Create Stripe PaymentIntent with delayed capture (escrow).
 * Money is authorized but NOT captured until deal_completed.
 */
export async function createEscrow(dealId: string): Promise<string> {
  const { data: deal } = await supabaseAdmin
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single();

  if (!deal || !deal.amount) throw new Error('Deal not found or no amount');

  // AML re-check
  if (deal.amount > env.AML_DEAL_LIMIT_EUR * 1.955) {
    throw new Error('AML limit exceeded');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(deal.amount * 100), // Stripe uses cents
    currency: deal.currency.toLowerCase(),
    capture_method: 'manual', // DELAYED CAPTURE — escrow
    metadata: {
      deal_id: dealId,
      creator_id: deal.creator_id,
      counterparty_id: deal.counterparty_id || '',
    },
    idempotency_key: deal.idempotency_key || undefined,
  } as any);

  await supabaseAdmin
    .from('deals')
    .update({
      stripe_payment_intent_id: paymentIntent.id,
      stripe_capture_status: 'authorized',
    })
    .eq('id', dealId);

  await supabaseAdmin.from('deal_events').insert({
    deal_id: dealId,
    actor_id: deal.creator_id,
    action: 'escrow_created',
    payload: { payment_intent_id: paymentIntent.id, amount: deal.amount },
  });

  logger.info({ dealId, piId: paymentIntent.id, amount: deal.amount }, 'Escrow created');
  return paymentIntent.client_secret!;
}

/**
 * Sign a deal (creator or counterparty).
 * For КЕП: triggers Evrotrust API.
 * For simple: records signature timestamp.
 */
export async function signDeal(dealId: string, signerId: string): Promise<void> {
  const { data: deal } = await supabaseAdmin
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single();

  if (!deal) throw new Error('Deal not found');

  const isCreator = deal.creator_id === signerId;
  const isCounter = deal.counterparty_id === signerId;
  if (!isCreator && !isCounter) throw new Error('Not a participant');

  const now = new Date().toISOString();
  const updateField = isCreator ? 'creator_signed_at' : 'counter_signed_at';

  if (deal.signature_type === 'kep') {
    // Evrotrust КЕП signing
    const evrotrustResult = await triggerEvrotrustSign(dealId, signerId);
    await supabaseAdmin
      .from('deals')
      .update({
        [updateField]: now,
        evrotrust_doc_id: evrotrustResult.docId,
        evrotrust_status: 'signed',
      })
      .eq('id', dealId);
  } else {
    await supabaseAdmin
      .from('deals')
      .update({ [updateField]: now })
      .eq('id', dealId);
  }

  // Check if both signed
  const { data: updated } = await supabaseAdmin
    .from('deals')
    .select('creator_signed_at, counter_signed_at')
    .eq('id', dealId)
    .single();

  if (updated?.creator_signed_at && updated?.counter_signed_at) {
    await supabaseAdmin
      .from('deals')
      .update({ status: 'signed' })
      .eq('id', dealId);

    // If escrow exists, move to escrow_held
    if (deal.stripe_payment_intent_id) {
      await supabaseAdmin
        .from('deals')
        .update({ status: 'escrow_held' })
        .eq('id', dealId);
    }
  } else {
    await supabaseAdmin
      .from('deals')
      .update({ status: 'pending_signature' })
      .eq('id', dealId);
  }

  await supabaseAdmin.from('deal_events').insert({
    deal_id: dealId,
    actor_id: signerId,
    action: 'deal_signed',
    payload: { role: isCreator ? 'creator' : 'counterparty', type: deal.signature_type },
  });

  logger.info({ dealId, signerId, type: deal.signature_type }, 'Deal signed');
}

/**
 * Complete a deal — capture escrow, archive contract, update Index.
 */
export async function completeDeal(dealId: string, confirmerId: string): Promise<void> {
  const { data: deal } = await supabaseAdmin
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single();

  if (!deal) throw new Error('Deal not found');
  if (!['signed', 'escrow_held'].includes(deal.status)) {
    throw new Error('Deal must be signed before completion');
  }

  // Capture Stripe payment if exists
  if (deal.stripe_payment_intent_id && deal.stripe_capture_status === 'authorized') {
    await stripe.paymentIntents.capture(deal.stripe_payment_intent_id);

    await supabaseAdmin
      .from('deals')
      .update({ stripe_capture_status: 'captured' })
      .eq('id', dealId);
  }

  // Mark completed
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('deals')
    .update({ status: 'completed', completed_at: now })
    .eq('id', dealId);

  // Log events
  await supabaseAdmin.from('deal_events').insert({
    deal_id: dealId,
    actor_id: confirmerId,
    action: 'deal_completed',
    payload: {},
  });

  // Emit — Index +15% for both parties
  bus.emit('deal_completed', { dealId, userId: deal.creator_id });
  if (deal.counterparty_id) {
    bus.emit('deal_completed', { dealId, userId: deal.counterparty_id });
  }

  logger.info({ dealId }, 'Deal completed');
}

/**
 * Dispute a deal — refund escrow within 48h.
 */
export async function disputeDeal(dealId: string, disputerId: string, reason: string): Promise<void> {
  const { data: deal } = await supabaseAdmin
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single();

  if (!deal) throw new Error('Deal not found');

  // Refund if escrow exists
  if (deal.stripe_payment_intent_id && deal.stripe_capture_status === 'authorized') {
    await stripe.paymentIntents.cancel(deal.stripe_payment_intent_id);
    await supabaseAdmin
      .from('deals')
      .update({ stripe_capture_status: 'refunded', status: 'disputed' })
      .eq('id', dealId);
  } else if (deal.stripe_payment_intent_id && deal.stripe_capture_status === 'captured') {
    await stripe.refunds.create({ payment_intent: deal.stripe_payment_intent_id });
    await supabaseAdmin
      .from('deals')
      .update({ stripe_capture_status: 'refunded', status: 'refunded' })
      .eq('id', dealId);
  } else {
    await supabaseAdmin
      .from('deals')
      .update({ status: 'disputed' })
      .eq('id', dealId);
  }

  await supabaseAdmin.from('deal_events').insert({
    deal_id: dealId,
    actor_id: disputerId,
    action: 'deal_disputed',
    payload: { reason },
  });

  logger.info({ dealId, disputerId, reason }, 'Deal disputed');
}

/**
 * Evrotrust КЕП signing stub.
 * In production: POST /sign/kep or /sign/simple to Evrotrust API.
 */
async function triggerEvrotrustSign(dealId: string, signerId: string): Promise<{ docId: string }> {
  // POST evrotrust_api_url/sign/kep { document_id, signers[] }
  // Returns: { docId, status }
  logger.info({ dealId, signerId }, 'Evrotrust КЕП signing triggered');
  return { docId: `evrotrust_${dealId}_${Date.now()}` };
}

/**
 * Generate contract from template.
 * HOX auto-fills: parties, amount, terms, dates.
 */
export async function generateContract(dealId: string): Promise<string> {
  const { data: deal } = await supabaseAdmin
    .from('deals')
    .select('*, creator:users!deals_creator_id_fkey(display_name, phone), counterparty:users!deals_counterparty_id_fkey(display_name, phone)')
    .eq('id', dealId)
    .single();

  if (!deal) throw new Error('Deal not found');

  const templates: Record<string, string> = {
    rent: 'ДОГОВОР ЗА НАЕМ',
    service: 'ДОГОВОР ЗА УСЛУГА',
    nda: 'СПОРАЗУМЕНИЕ ЗА НЕРАЗКРИВАНЕ (NDA)',
    sale: 'ДОГОВОР ЗА ПОКУПКО-ПРОДАЖБА',
    protocol: 'ПРИЕМО-ПРЕДАВАТЕЛЕН ПРОТОКОЛ',
    offer: 'ОФЕРТА',
    custom: 'ДОГОВОР',
  };

  const templateTitle = templates[deal.template] || 'ДОГОВОР';
  const today = new Date().toLocaleDateString('bg-BG');
  const creator = (deal as any).creator;
  const counter = (deal as any).counterparty;

  const contract = `
${templateTitle}

Дата: ${today}
Номер: HOX-${deal.id.slice(0, 8).toUpperCase()}

СТРАНА 1 (Възложител):
Име: ${creator?.display_name || 'Не е посочено'}
Телефон: ${creator?.phone || ''}

СТРАНА 2 (Изпълнител):
Име: ${counter?.display_name || 'Не е посочено'}
Телефон: ${counter?.phone || ''}

ПРЕДМЕТ:
${deal.title}
${deal.description || ''}

СТОЙНОСТ: ${deal.amount ? `${deal.amount} ${deal.currency}` : 'Не е посочена'}

УСЛОВИЯ:
1. Настоящият договор влиза в сила след подписване от двете страни.
2. Плащането се извършва чрез HOX Escrow (Stripe).
3. При спор — парите се връщат в рамките на 48 часа.
4. Договорът се архивира криптирано в HOX Vault.

ПОДПИСИ:
Страна 1: ${deal.creator_signed_at ? `Подписан на ${new Date(deal.creator_signed_at).toLocaleDateString('bg-BG')}` : '_______________'}
Страна 2: ${deal.counter_signed_at ? `Подписан на ${new Date(deal.counter_signed_at).toLocaleDateString('bg-BG')}` : '_______________'}

Генериран автоматично от HOX.
`.trim();

  return contract;
}

/**
 * List deals for a user (as creator or counterparty).
 */
export async function listDeals(userId: string): Promise<DealRow[]> {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('*')
    .or(`creator_id.eq.${userId},counterparty_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as DealRow[];
}

/**
 * Get deal with full event history.
 */
export async function getDeal(dealId: string, userId: string): Promise<{ deal: DealRow; events: any[] }> {
  const { data: deal } = await supabaseAdmin
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .or(`creator_id.eq.${userId},counterparty_id.eq.${userId}`)
    .single();

  if (!deal) throw new Error('Deal not found');

  const { data: events } = await supabaseAdmin
    .from('deal_events')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true });

  return { deal: deal as DealRow, events: events || [] };
}
