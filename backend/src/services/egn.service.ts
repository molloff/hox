import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { wipeBuffer } from '../utils/memoryWipe.js';
import { logger } from '../utils/logger.js';

const BCRYPT_ROUNDS = 12;

/**
 * Hash an EGN (Bulgarian national ID number) with bcrypt.
 * The plaintext EGN is wiped from memory immediately after hashing.
 *
 * SECURITY: EGN is extremely sensitive PII. This function:
 * 1. Converts EGN to Buffer immediately
 * 2. Concatenates with server-side salt
 * 3. Hashes with bcrypt (12 rounds)
 * 4. Wipes all buffers containing the plaintext
 * 5. Returns only the hash
 */
export async function hashEgn(egn: string): Promise<string> {
  // Convert to buffer immediately to enable wiping
  const egnBuf = Buffer.from(egn, 'utf8');
  const saltBuf = Buffer.from(env.EGN_SALT, 'utf8');
  const combined = Buffer.concat([egnBuf, saltBuf]);

  try {
    const hash = await bcrypt.hash(combined.toString('utf8'), BCRYPT_ROUNDS);
    logger.info('EGN hashed successfully');
    return hash;
  } finally {
    // Wipe all sensitive buffers regardless of success/failure
    wipeBuffer(egnBuf);
    wipeBuffer(saltBuf);
    wipeBuffer(combined);
  }
}

/**
 * Verify a plaintext EGN against a stored hash.
 * Used only in exceptional circumstances (re-verification).
 */
export async function verifyEgn(egn: string, hash: string): Promise<boolean> {
  const egnBuf = Buffer.from(egn, 'utf8');
  const saltBuf = Buffer.from(env.EGN_SALT, 'utf8');
  const combined = Buffer.concat([egnBuf, saltBuf]);

  try {
    return await bcrypt.compare(combined.toString('utf8'), hash);
  } finally {
    wipeBuffer(egnBuf);
    wipeBuffer(saltBuf);
    wipeBuffer(combined);
  }
}
