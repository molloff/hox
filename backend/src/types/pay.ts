export type BillStatus = 'pending' | 'upcoming' | 'overdue' | 'paid' | 'failed';
export type BillSource = 'epay' | 'gmail' | 'nordigen' | 'manual' | 'nap' | 'kat' | 'egov';
export type ObligationType =
  | 'tax_income' | 'tax_vat' | 'tax_property' | 'tax_vehicle'
  | 'tax_dog' | 'social_insurance' | 'health_insurance'
  | 'fine_kat' | 'fine_other' | 'municipal';

export type DealStatus =
  | 'draft' | 'pending_signature' | 'signed'
  | 'escrow_held' | 'completed' | 'disputed' | 'refunded' | 'cancelled';
export type DealTemplate = 'rent' | 'service' | 'nda' | 'sale' | 'protocol' | 'offer' | 'custom';
export type SignatureType = 'simple' | 'kep';

export interface TrafficLight {
  color: 'green' | 'yellow' | 'red' | 'grey';
  daysLeft: number | null;
}

export interface ObligationRow {
  id: string;
  user_id: string;
  type: ObligationType;
  title: string;
  amount: number;
  currency: string;
  status: BillStatus;
  source: BillSource;
  reference_id: string | null;
  due_date: string | null;
  paid_at: string | null;
  paid_via: string | null;
  index_points: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DealRow {
  id: string;
  creator_id: string;
  counterparty_id: string | null;
  status: DealStatus;
  template: DealTemplate;
  title: string;
  description: string;
  amount: number | null;
  currency: string;
  signature_type: SignatureType;
  stripe_payment_intent_id: string | null;
  stripe_capture_status: string;
  evrotrust_doc_id: string | null;
  evrotrust_status: string | null;
  creator_signed_at: string | null;
  counter_signed_at: string | null;
  contract_vault_file_id: string | null;
  idempotency_key: string | null;
  expires_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
