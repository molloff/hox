import { randomBytes } from 'node:crypto';
import { writeSecret, readSecret, deleteSecret } from '../config/vault.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Generate a per-user AES-256 key and store it in HashiCorp Vault.
 * The key never touches the database — only a reference path is stored.
 */
export async function createUserKey(userId: string): Promise<void> {
  const aesKey = randomBytes(32);
  const path = `users/${userId}`;

  await writeSecret(path, {
    aes_key: aesKey.toString('hex'),
    created_at: new Date().toISOString(),
  });

  // Store only the vault path reference in the database
  await supabaseAdmin
    .from('users')
    .update({ vault_key_id: path })
    .eq('id', userId);

  // Wipe the key from local memory
  aesKey.fill(0);

  logger.info({ userId }, 'Vault key created');
}

/**
 * Retrieve the AES-256 key for a user from Vault.
 */
export async function getUserKey(userId: string): Promise<Buffer> {
  const data = await readSecret(`users/${userId}`);
  if (!data || !data.aes_key) {
    throw new Error(`No Vault key found for user ${userId}`);
  }
  return Buffer.from(data.aes_key as string, 'hex');
}

/**
 * Delete all Vault secrets for a user (account deletion).
 */
export async function deleteUserKeys(userId: string): Promise<void> {
  await deleteSecret(`users/${userId}`);
  logger.info({ userId }, 'Vault keys deleted');
}
