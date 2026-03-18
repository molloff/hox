import { DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { textract } from '../config/textract.js';
import { s3, VAULT_BUCKET } from '../config/s3.js';
import { getUserKey } from './vault.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Run AWS Textract OCR on a vault file.
 *
 * Flow:
 * 1. Download encrypted file from S3
 * 2. Decrypt with user's key
 * 3. Send decrypted bytes to Textract
 * 4. Store extracted text in vault_files.ocr_text
 * 5. Wipe decrypted bytes from memory
 *
 * Cost: ~€0.01/page
 */
export async function runOcr(userId: string, fileId: string): Promise<string> {
  // Mark as processing
  await supabaseAdmin
    .from('vault_files')
    .update({ ocr_status: 'processing' })
    .eq('id', fileId);

  try {
    // Get file metadata
    const { data: file } = await supabaseAdmin
      .from('vault_files')
      .select('s3_key, iv, auth_tag, mime_type')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (!file) throw new Error('File not found');

    // Download encrypted from S3
    const response = await s3.send(new GetObjectCommand({
      Bucket: VAULT_BUCKET,
      Key: file.s3_key,
    }));
    const encrypted = Buffer.from(await response.Body!.transformToByteArray());

    // Decrypt
    const key = await getUserKey(userId);
    const iv = Buffer.from(file.iv, 'hex');
    const authTag = Buffer.from(file.auth_tag, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    key.fill(0);

    // Run Textract
    const textractResult = await textract.send(new DetectDocumentTextCommand({
      Document: { Bytes: decrypted },
    }));

    // Wipe decrypted data
    decrypted.fill(0);

    // Extract text lines
    const blocks = textractResult.Blocks || [];
    const lines = blocks
      .filter((b) => b.BlockType === 'LINE')
      .map((b) => b.Text || '')
      .join('\n');

    // Store OCR text
    await supabaseAdmin
      .from('vault_files')
      .update({ ocr_text: lines, ocr_status: 'done' })
      .eq('id', fileId);

    logger.info({ userId, fileId, textLength: lines.length }, 'OCR completed');

    return lines;
  } catch (err) {
    await supabaseAdmin
      .from('vault_files')
      .update({ ocr_status: 'failed' })
      .eq('id', fileId);

    logger.error({ userId, fileId, err }, 'OCR failed');
    throw err;
  }
}

/**
 * Parse expiry dates from OCR text (e.g., ID cards, warranties).
 * Returns date string if found, null otherwise.
 */
export function extractExpiryDate(ocrText: string): string | null {
  // Bulgarian date patterns: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
  const patterns = [
    /валидн[аo]\s*до[:\s]*(\d{2}[./-]\d{2}[./-]\d{4})/i,
    /изтича[:\s]*(\d{2}[./-]\d{2}[./-]\d{4})/i,
    /valid\s*(?:until|to|thru)[:\s]*(\d{2}[./-]\d{2}[./-]\d{4})/i,
    /expir[ey][:\s]*(\d{2}[./-]\d{2}[./-]\d{4})/i,
    /гаранция[:\s]*.*?до[:\s]*(\d{2}[./-]\d{2}[./-]\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = ocrText.match(pattern);
    if (match) {
      const [day, month, year] = match[1].split(/[./-]/);
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}
