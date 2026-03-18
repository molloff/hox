export type VaultCategory =
  | 'documents' | 'receipts' | 'warranties' | 'health'
  | 'children' | 'pets' | 'diary' | 'contracts' | 'certificates';

export interface VaultFileRow {
  id: string;
  user_id: string;
  category: VaultCategory;
  title: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  s3_key: string;
  iv: string;
  auth_tag: string;
  ocr_text: string | null;
  ocr_status: string;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VaultShareRow {
  id: string;
  user_id: string;
  vault_file_id: string;
  token: string;
  scope: string[];
  expires_at: string;
  max_views: number;
  view_count: number;
  is_revoked: boolean;
  created_at: string;
}

export interface VaultAuditRow {
  id: string;
  vault_share_id: string;
  vault_file_id: string;
  accessor_ip: string | null;
  accessor_ua: string | null;
  action: string;
  created_at: string;
}

export interface VaultEmbeddingRow {
  id: string;
  vault_file_id: string;
  user_id: string;
  embedding: number[];
  chunk_text: string;
  chunk_index: number;
  created_at: string;
}
