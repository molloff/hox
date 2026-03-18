import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { VaultShareRow } from '../types/vault.js';

interface CreateShareOpts {
  userId: string;
  fileId: string;
  scope?: string[];
  expiresInMinutes?: number;
  maxViews?: number;
}

interface ShareResult {
  shareId: string;
  token: string;
  expiresAt: string;
  url: string;
}

/**
 * Create a QR share link with JWT token.
 * Token encodes: fileId, userId, scope, expiry.
 * Default: 10 min expiry, 1 view max.
 */
export async function createShare(opts: CreateShareOpts): Promise<ShareResult> {
  const {
    userId,
    fileId,
    scope = ['read'],
    expiresInMinutes = 10,
    maxViews = 1,
  } = opts;

  // Verify file belongs to user
  const { data: file } = await supabaseAdmin
    .from('vault_files')
    .select('id')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (!file) {
    throw new Error('File not found');
  }

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Generate JWT token
  const token = jwt.sign(
    {
      type: 'vault_share',
      fileId,
      userId,
      scope,
    },
    env.SHARE_JWT_SECRET,
    { expiresIn: `${expiresInMinutes}m` }
  );

  // Store share record
  const { data: share, error } = await supabaseAdmin
    .from('vault_shares')
    .insert({
      user_id: userId,
      vault_file_id: fileId,
      token,
      scope,
      expires_at: expiresAt.toISOString(),
      max_views: maxViews,
    })
    .select('id')
    .single();

  if (error || !share) {
    throw new Error(`Failed to create share: ${error?.message}`);
  }

  logger.info({ userId, fileId, shareId: share.id, expiresInMinutes }, 'Vault share created');

  return {
    shareId: share.id,
    token,
    expiresAt: expiresAt.toISOString(),
    url: `hox://vault/share/${token}`,
  };
}

/**
 * Access a shared file via token.
 * Validates: token signature, expiry, view count, revocation.
 * Logs access in audit log.
 */
export async function accessShare(
  token: string,
  accessorIp: string,
  accessorUa: string
): Promise<{ fileId: string; userId: string; scope: string[] }> {
  // Verify JWT
  let payload: any;
  try {
    payload = jwt.verify(token, env.SHARE_JWT_SECRET);
  } catch {
    throw new Error('Invalid or expired share link');
  }

  if (payload.type !== 'vault_share') {
    throw new Error('Invalid token type');
  }

  // Look up share record
  const { data: share, error } = await supabaseAdmin
    .from('vault_shares')
    .select('*')
    .eq('token', token)
    .single();

  if (error || !share) {
    throw new Error('Share not found');
  }

  const shareRow = share as VaultShareRow;

  // Validate
  if (shareRow.is_revoked) {
    throw new Error('Share has been revoked');
  }

  if (new Date(shareRow.expires_at) < new Date()) {
    throw new Error('Share has expired');
  }

  if (shareRow.max_views && shareRow.view_count >= shareRow.max_views) {
    throw new Error('Maximum views exceeded');
  }

  // Increment view count
  await supabaseAdmin
    .from('vault_shares')
    .update({ view_count: shareRow.view_count + 1 })
    .eq('id', shareRow.id);

  // Audit log
  await supabaseAdmin.from('vault_audit_log').insert({
    vault_share_id: shareRow.id,
    vault_file_id: shareRow.vault_file_id,
    accessor_ip: accessorIp,
    accessor_ua: accessorUa,
    action: 'view',
  });

  logger.info({
    shareId: shareRow.id,
    fileId: shareRow.vault_file_id,
    viewCount: shareRow.view_count + 1,
  }, 'Vault share accessed');

  return {
    fileId: shareRow.vault_file_id,
    userId: shareRow.user_id,
    scope: shareRow.scope,
  };
}

/**
 * Revoke a share link.
 */
export async function revokeShare(userId: string, shareId: string): Promise<void> {
  await supabaseAdmin
    .from('vault_shares')
    .update({ is_revoked: true })
    .eq('id', shareId)
    .eq('user_id', userId);

  logger.info({ userId, shareId }, 'Vault share revoked');
}

/**
 * List all shares for a file.
 */
export async function listShares(userId: string, fileId: string): Promise<VaultShareRow[]> {
  const { data } = await supabaseAdmin
    .from('vault_shares')
    .select('*')
    .eq('user_id', userId)
    .eq('vault_file_id', fileId)
    .order('created_at', { ascending: false });

  return (data || []) as VaultShareRow[];
}

/**
 * Get audit log for a file.
 */
export async function getAuditLog(userId: string, fileId: string): Promise<any[]> {
  // First verify ownership
  const { data: file } = await supabaseAdmin
    .from('vault_files')
    .select('id')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (!file) throw new Error('File not found');

  const { data } = await supabaseAdmin
    .from('vault_audit_log')
    .select('id, vault_share_id, accessor_ip, accessor_ua, action, created_at')
    .eq('vault_file_id', fileId)
    .order('created_at', { ascending: false });

  return data || [];
}
