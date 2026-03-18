import api from './api';

export type DealTemplate = 'rent' | 'service' | 'nda' | 'sale' | 'protocol' | 'offer' | 'custom';

export interface Deal {
  id: string;
  creator_id: string;
  counterparty_id: string | null;
  status: string;
  template: DealTemplate;
  title: string;
  description: string;
  amount: number | null;
  currency: string;
  signature_type: string;
  creator_signed_at: string | null;
  counter_signed_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DealEvent {
  id: string;
  action: string;
  actor_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function listDeals(): Promise<Deal[]> {
  const { data } = await api.get('/deal');
  return data.deals;
}

export async function createDeal(input: {
  template: DealTemplate;
  title: string;
  description?: string;
  amount?: number;
  counterpartyId?: string;
}): Promise<Deal> {
  const { data } = await api.post('/deal', input);
  return data.deal;
}

export async function getDeal(dealId: string): Promise<{ deal: Deal; events: DealEvent[] }> {
  const { data } = await api.get(`/deal/${dealId}`);
  return data;
}

export async function createEscrow(dealId: string): Promise<string> {
  const { data } = await api.post(`/deal/${dealId}/escrow`);
  return data.clientSecret;
}

export async function signDeal(dealId: string): Promise<void> {
  await api.post(`/deal/${dealId}/sign`);
}

export async function completeDeal(dealId: string): Promise<void> {
  await api.post(`/deal/${dealId}/complete`);
}

export async function disputeDeal(dealId: string, reason: string): Promise<void> {
  await api.post(`/deal/${dealId}/dispute`, { reason });
}

export async function getContract(dealId: string): Promise<string> {
  const { data } = await api.get(`/deal/${dealId}/contract`);
  return data.contract;
}
