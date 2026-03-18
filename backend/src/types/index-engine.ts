export type IndexSource = 'official' | 'system' | 'verified' | 'self';
export type IndexPillar = 'financial' | 'behavioral' | 'physical' | 'civic';

export interface IndexEvent {
  eventName: string;
  delta: number;
  source: IndexSource;
  pillar: IndexPillar;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface PillarScore {
  pillar: IndexPillar;
  weight: number;
  rawScore: number;
  weightedScore: number;
}

export interface HoxScore {
  total: number;
  percentage: number;
  pillars: PillarScore[];
  eventCount: number;
  lastUpdated: string;
}

export const SOURCE_WEIGHTS: Record<IndexSource, number> = {
  official: 3.0,
  system: 1.5,
  verified: 1.0,
  self: 0.3,
};

export const PILLAR_WEIGHTS: Record<IndexPillar, number> = {
  financial: 0.35,
  behavioral: 0.30,
  physical: 0.20,
  civic: 0.15,
};

export interface CapRule {
  eventName: string;
  maxPerDay: number;
  maxPerWeek?: number;
}

export const CAP_RULES: CapRule[] = [
  { eventName: 'bill_paid_ontime', maxPerDay: 1 },
  { eventName: 'bill_paid_manual', maxPerDay: 0.3 },
  { eventName: 'nap_paid', maxPerDay: 2, maxPerWeek: 2 },
  { eventName: 'kat_paid', maxPerDay: 1 },
  { eventName: 'file_archived', maxPerDay: 2 },
  { eventName: 'deal_completed', maxPerDay: 5 },
  // Negative events have no cap
];
