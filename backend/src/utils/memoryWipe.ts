/**
 * Securely wipe a Buffer by overwriting with zeros.
 * Call this immediately after hashing sensitive data (EGN).
 *
 * Note: JavaScript strings are immutable and GC-managed — they cannot be wiped.
 * Always receive sensitive data as Buffer, never as string.
 */
export function wipeBuffer(buf: Buffer): void {
  buf.fill(0);
}

/**
 * Create a Buffer from a string, execute a callback, then wipe the buffer.
 * Ensures cleanup even if the callback throws.
 */
export async function withSensitiveBuffer<T>(
  value: string,
  callback: (buf: Buffer) => Promise<T>
): Promise<T> {
  const buf = Buffer.from(value, 'utf8');
  try {
    return await callback(buf);
  } finally {
    wipeBuffer(buf);
  }
}
