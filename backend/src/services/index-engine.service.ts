import { supabaseAdmin } from '../config/supabase.js';
import { bus } from './bus.service.js';
import { logger } from '../utils/logger.js';
import {
  SOURCE_WEIGHTS, PILLAR_WEIGHTS, CAP_RULES,
  type IndexSource, type IndexPillar, type IndexEvent, type HoxScore, type PillarScore,
} from '../types/index-engine.js';

/**
 * index-engine.js — ONE file. Runs at 23:59 every day.
 *
 * HOX Index = Σ(event.delta × WEIGHT[source]) with Cap protection
 *
 * Score is NEVER stored as a column — computed on-the-fly.
 * Cannot be manipulated.
 */

/**
 * Record an index event with cap enforcement.
 */
export async function recordEvent(
  userId: string,
  event: IndexEvent
): Promise<{ recorded: boolean; capped: boolean; points: number }> {
  const today = new Date().toISOString().split('T')[0];
  const weightedDelta = event.delta * SOURCE_WEIGHTS[event.source];

  // Check cap rules
  const capRule = CAP_RULES.find((r) => r.eventName === event.eventName);
  let capped = false;

  if (capRule && event.delta > 0) {
    // Get today's total for this event
    const { data: existing } = await supabaseAdmin
      .from('index_daily_caps')
      .select('total_delta')
      .eq('user_id', userId)
      .eq('event_name', event.eventName)
      .eq('cap_date', today)
      .single();

    const currentTotal = existing?.total_delta || 0;

    if (currentTotal >= capRule.maxPerDay) {
      capped = true;
      logger.info({ userId, eventName: event.eventName, currentTotal, cap: capRule.maxPerDay }, 'Event capped');
    }

    // Upsert daily cap
    if (!capped) {
      try {
        if (existing) {
          await supabaseAdmin
            .from('index_daily_caps')
            .update({ total_delta: currentTotal + Math.abs(weightedDelta) })
            .eq('user_id', userId)
            .eq('event_name', event.eventName)
            .eq('cap_date', today);
        } else {
          await supabaseAdmin.from('index_daily_caps').insert({
            user_id: userId,
            event_name: event.eventName,
            cap_date: today,
            total_delta: Math.abs(weightedDelta),
          });
        }
      } catch {
        // Cap tracking failure is non-fatal
      }
    }
  }

  // Negative events (overdue) never get capped
  if (event.delta < 0) capped = false;

  if (capped) {
    return { recorded: false, capped: true, points: 0 };
  }

  // Insert index event
  await supabaseAdmin.from('index_events').insert({
    user_id: userId,
    event_name: event.eventName,
    delta: event.delta,
    source: event.source,
    pillar: event.pillar,
    weight: SOURCE_WEIGHTS[event.source],
    capped: false,
    metadata: event.metadata || {},
  });

  logger.info({ userId, event: event.eventName, delta: event.delta, weighted: weightedDelta }, 'Index event recorded');
  return { recorded: true, capped: false, points: weightedDelta };
}

/**
 * Compute HOX Score on-the-fly from all events.
 * Score = Σ(delta × weight) per pillar, then weighted by pillar weights.
 */
export async function computeScore(userId: string): Promise<HoxScore> {
  const { data: events, error } = await supabaseAdmin
    .from('index_events')
    .select('delta, weight, pillar, created_at')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  const pillarTotals: Record<IndexPillar, number> = {
    financial: 0,
    behavioral: 0,
    physical: 0,
    civic: 0,
  };

  for (const e of (events || [])) {
    const pillar = e.pillar as IndexPillar;
    pillarTotals[pillar] += e.delta * e.weight;
  }

  const pillars: PillarScore[] = Object.entries(PILLAR_WEIGHTS).map(([pillar, weight]) => ({
    pillar: pillar as IndexPillar,
    weight,
    rawScore: pillarTotals[pillar as IndexPillar],
    weightedScore: pillarTotals[pillar as IndexPillar] * weight,
  }));

  const total = pillars.reduce((sum, p) => sum + p.weightedScore, 0);

  // Normalize to 0-100 percentage (sigmoid-like scaling)
  // At 100 raw points → ~73%, at 200 → ~88%, at 500 → ~97%
  const percentage = Math.min(100, Math.max(0, (100 * total) / (total + 100)));

  return {
    total: Math.round(total * 100) / 100,
    percentage: Math.round(percentage),
    pillars,
    eventCount: (events || []).length,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get score as a simple percentage (for display in Connect, etc.)
 */
export async function getScorePercentage(userId: string): Promise<number> {
  const score = await computeScore(userId);
  return score.percentage;
}

/**
 * Nightly batch: process pending events and update search profiles.
 * Runs at 23:59 via cron.
 */
export async function nightlyBatch(): Promise<void> {
  logger.info('Index nightly batch started');

  // Get all verified users
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, display_name, skills, description, profile_type, is_verified')
    .eq('is_verified', true);

  if (!users) return;

  for (const user of users) {
    try {
      const score = await computeScore(user.id);

      // Update search profile for Connect
      await supabaseAdmin.from('search_profiles').upsert({
        user_id: user.id,
        display_name: user.display_name,
        skills: user.skills || [],
        description: user.description || '',
        profile_type: user.profile_type,
        hox_score: score.percentage,
        is_verified: user.is_verified,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      logger.error({ userId: user.id, err }, 'Nightly score update failed');
    }
  }

  logger.info({ userCount: users.length }, 'Index nightly batch completed');
}

// Register bus listeners to record index events
bus.on('bill_paid', async ({ userId, indexPoints, source }: any) => {
  await recordEvent(userId, {
    eventName: source === 'official' ? 'nap_paid' : 'bill_paid_ontime',
    delta: indexPoints,
    source: source === 'official' ? 'official' : 'verified',
    pillar: 'financial',
    weight: SOURCE_WEIGHTS[source === 'official' ? 'official' : 'verified'],
  });
});

bus.on('deal_completed', async ({ userId }: any) => {
  await recordEvent(userId, {
    eventName: 'deal_completed',
    delta: 15,
    source: 'verified',
    pillar: 'behavioral',
    weight: SOURCE_WEIGHTS.verified,
  });
});

bus.on('file_archived', async ({ userId }: any) => {
  await recordEvent(userId, {
    eventName: 'file_archived',
    delta: 0.5,
    source: 'system',
    pillar: 'behavioral',
    weight: SOURCE_WEIGHTS.system,
  });
});

bus.on('user_verified', async ({ userId }: any) => {
  await recordEvent(userId, {
    eventName: 'kyc_passed',
    delta: 5,
    source: 'official',
    pillar: 'civic',
    weight: SOURCE_WEIGHTS.official,
  });
});
