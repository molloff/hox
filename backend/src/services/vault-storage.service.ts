import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3, VAULT_BUCKET } from '../config/s3.js';
import { getUserKey } from './vault.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { bus } from './bus.service.js';
import { logger } from '../utils/logger.js';
import type { VaultCategory } from '../types/vault.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

interface UploadResult {
  fileId: string;
  s3Key: string;
}

/**
 * Encrypt a file with the user's AES-256-GCM key and upload to S3.
 * The file is encrypted BEFORE leaving the server — S3 never sees plaintext.
 */
export async function uploadEncryptedFile(
  userId: string,
  fileBuffer: Buffer,
  opts: {
    category: VaultCategory;
    title: string;
    originalName: string;
    mimeType: string;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<UploadResult> {
  // Get user's encryption key from HashiCorp Vault
  const key = await getUserKey(userId);

  // Encrypt
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Wipe key from memory
  key.fill(0);

  // Generate S3 path
  const s3Key = `vault/${userId}/${opts.category}/${randomBytes(16).toString('hex')}`;

  // Upload encrypted data to S3
  await s3.send(new PutObjectCommand({
    Bucket: VAULT_BUCKET,
    Key: s3Key,
    Body: encrypted,
    ContentType: 'application/octet-stream', // Always octet-stream — it's encrypted
    Metadata: {
      'x-hox-user': userId,
      'x-hox-category': opts.category,
    },
  }));

  // Insert vault_files row
  const { data: fileRow, error } = await supabaseAdmin
    .from('vault_files')
    .insert({
      user_id: userId,
      category: opts.category,
      title: opts.title,
      original_name: opts.originalName,
      mime_type: opts.mimeType,
      size_bytes: fileBuffer.length,
      s3_key: s3Key,
      iv: iv.toString('hex'),
      auth_tag: authTag.toString('hex'),
      expires_at: opts.expiresAt || null,
      metadata: opts.metadata || {},
    })
    .select('id')
    .single();

  if (error || !fileRow) {
    throw new Error(`Failed to save vault file record: ${error?.message}`);
  }

  // Log event + bus emit for Index
  await supabaseAdmin.from('events').insert({
    user_id: userId,
    type: 'vault_key_created', // reusing event type for file archival
    payload: { vault_file_id: fileRow.id, category: opts.category },
  });

  bus.emit('file_archived', { userId, fileId: fileRow.id });

  logger.info({ userId, fileId: fileRow.id, category: opts.category }, 'File encrypted and uploaded to Vault');

  return { fileId: fileRow.id, s3Key };
}

/**
 * Download and decrypt a file from S3 using the user's key.
 */
export async function downloadDecryptedFile(
  userId: string,
  fileId: string
): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
  const { data: file, error } = await supabaseAdmin
    .from('vault_files')
    .select('*')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (error || !file) {
    throw new Error('File not found');
  }

  // Get encrypted data from S3
  const response = await s3.send(new GetObjectCommand({
    Bucket: VAULT_BUCKET,
    Key: file.s3_key,
  }));

  const encrypted = Buffer.from(await response.Body!.transformToByteArray());

  // Decrypt with user's key
  const key = await getUserKey(userId);
  const iv = Buffer.from(file.iv, 'hex');
  const authTag = Buffer.from(file.auth_tag, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  // Wipe key
  key.fill(0);

  return {
    buffer: decrypted,
    mimeType: file.mime_type,
    originalName: file.original_name,
  };
}

/**
 * Delete a file from S3 and database.
 */
export async function deleteVaultFile(userId: string, fileId: string): Promise<void> {
  const { data: file } = await supabaseAdmin
    .from('vault_files')
    .select('s3_key')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (!file) {
    throw new Error('File not found');
  }

  // Delete from S3
  await s3.send(new DeleteObjectCommand({
    Bucket: VAULT_BUCKET,
    Key: file.s3_key,
  }));

  // Delete DB records (cascade deletes embeddings, shares, audit)
  await supabaseAdmin
    .from('vault_files')
    .delete()
    .eq('id', fileId)
    .eq('user_id', userId);

  logger.info({ userId, fileId }, 'Vault file deleted');
}

/**
 * List all vault files for a user, optionally filtered by category.
 */
export async function listVaultFiles(
  userId: string,
  category?: VaultCategory
): Promise<any[]> {
  let query = supabaseAdmin
    .from('vault_files')
    .select('id, category, title, original_name, mime_type, size_bytes, ocr_status, expires_at, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}
