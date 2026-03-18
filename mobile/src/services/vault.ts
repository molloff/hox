import api from './api';

export type VaultCategory =
  | 'documents' | 'receipts' | 'warranties' | 'health'
  | 'children' | 'pets' | 'diary' | 'contracts' | 'certificates';

export interface VaultFile {
  id: string;
  category: VaultCategory;
  title: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  ocr_status: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VaultShare {
  shareId: string;
  token: string;
  expiresAt: string;
  url: string;
}

export async function listFiles(category?: VaultCategory): Promise<VaultFile[]> {
  const params = category ? { category } : {};
  const { data } = await api.get('/vault/files', { params });
  return data.files;
}

export async function uploadFile(opts: {
  category: VaultCategory;
  title: string;
  fileBase64: string;
  originalName: string;
  mimeType: string;
  expiresAt?: string;
}): Promise<{ fileId: string }> {
  const { data } = await api.post('/vault/upload', opts);
  return data;
}

export async function deleteFile(fileId: string): Promise<void> {
  await api.delete(`/vault/files/${fileId}`);
}

export async function triggerOcr(fileId: string): Promise<string> {
  const { data } = await api.post(`/vault/files/${fileId}/ocr`);
  return data.text;
}

export async function searchVault(query: string): Promise<VaultFile[]> {
  const { data } = await api.get('/vault/search', { params: { q: query } });
  return data.results;
}

export async function createShare(opts: {
  fileId: string;
  expiresInMinutes?: number;
  maxViews?: number;
}): Promise<VaultShare> {
  const { data } = await api.post('/vault/share', opts);
  return data;
}

export async function revokeShare(shareId: string): Promise<void> {
  await api.delete(`/vault/share/${shareId}`);
}

export async function getAuditLog(fileId: string): Promise<any[]> {
  const { data } = await api.get(`/vault/files/${fileId}/audit`);
  return data.audit;
}

export async function getFileShares(fileId: string): Promise<any[]> {
  const { data } = await api.get(`/vault/files/${fileId}/shares`);
  return data.shares;
}
