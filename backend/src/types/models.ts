export type ProfileType = 'family' | 'freelancer' | 'small_business';
export type KycStatus = 'pending' | 'document_uploaded' | 'liveness_done' | 'verified' | 'rejected';
export type TaskStatusType = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type EventType =
  | 'otp_sent'
  | 'otp_verified'
  | 'kyc_started'
  | 'document_uploaded'
  | 'liveness_completed'
  | 'kyc_verified'
  | 'kyc_rejected'
  | 'profile_updated'
  | 'vault_key_created'
  | 'user_verified';

export interface UserRow {
  id: string;
  auth_id: string;
  phone: string;
  egn_hash: string | null;
  kyc_status: KycStatus;
  onfido_applicant_id: string | null;
  profile_type: ProfileType | null;
  display_name: string | null;
  skills: string[];
  description: string;
  company_name: string | null;
  eik: string | null;
  vault_key_id: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  user_id: string;
  type: EventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface BillRow {
  id: string;
  user_id: string;
  provider: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  source: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FileRow {
  id: string;
  user_id: string;
  bucket: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: TaskStatusType;
  due_date: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
