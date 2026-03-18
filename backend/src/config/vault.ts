import nodeVault from 'node-vault';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const vault = nodeVault({
  apiVersion: 'v1',
  endpoint: env.VAULT_ADDR,
  token: env.VAULT_TOKEN,
});

export async function initVault(): Promise<void> {
  try {
    const health = await vault.health();
    logger.info({ sealed: health.sealed, initialized: health.initialized }, 'Vault connected');
  } catch (err) {
    logger.error(err, 'Failed to connect to Vault');
    throw err;
  }
}

export async function writeSecret(path: string, data: Record<string, unknown>): Promise<void> {
  await vault.write(`secret/data/${path}`, { data });
}

export async function readSecret(path: string): Promise<Record<string, unknown> | null> {
  try {
    const result = await vault.read(`secret/data/${path}`);
    return result.data?.data ?? null;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 404) {
      return null;
    }
    throw err;
  }
}

export async function deleteSecret(path: string): Promise<void> {
  await vault.delete(`secret/metadata/${path}`);
}
