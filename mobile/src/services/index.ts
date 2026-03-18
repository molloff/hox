import api from './api';

export interface PillarScore {
  name: string;
  weight: string;
  rawScore: number;
  weighted: number;
}

export interface HoxScore {
  total: number;
  percentage: number;
  pillars: { pillar: string; weight: number; rawScore: number; weightedScore: number }[];
  eventCount: number;
  lastUpdated: string;
}

export interface IndexEvent {
  id: string;
  event_name: string;
  delta: number;
  source: string;
  pillar: string;
  weight: number;
  created_at: string;
}

export async function getScore(): Promise<HoxScore> {
  const { data } = await api.get('/index/score');
  return data;
}

export async function getBreakdown(): Promise<{ percentage: number; total: number; pillars: PillarScore[] }> {
  const { data } = await api.get('/index/breakdown');
  return data;
}

export async function getEvents(limit = 50): Promise<IndexEvent[]> {
  const { data } = await api.get('/index/events', { params: { limit } });
  return data.events;
}
