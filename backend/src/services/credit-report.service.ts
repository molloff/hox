import { supabaseAdmin } from '../config/supabase.js';
import { recordEvent } from './index-engine.service.js';
import { logger } from '../utils/logger.js';

/**
 * ЦКР (Central Credit Register) integration.
 *
 * v1 — PDF: User downloads PDF from bnb.bg with КЕП → uploads to HOX
 *       → node-forge verifies BNB signature → AWS Textract parses
 *       → Index: +18 points official 3.0×
 *
 * v2 — НБКИ API: At 5,000 users. POST /api/v1/credit-report { egn_hash, consent_id }
 *       Cost: €500-2,000 contract + €0.50-2.00/query
 *
 * v3 — Payment Institution: At 50,000 users. BNB license.
 *       €125,000 capital + €15-30K legal + 6-12 months
 */

/**
 * Process an uploaded ЦКР PDF.
 * 1. Verify BNB digital signature (node-forge)
 * 2. OCR the PDF with Textract
 * 3. Parse credit data
 * 4. Store and award index points
 */
export async function processCkrPdf(
  userId: string,
  ocrText: string,
  signatureValid: boolean
): Promise<void> {
  if (!signatureValid) {
    throw new Error('Invalid BNB signature on ЦКР PDF');
  }

  // Parse credit data from OCR text
  const credits = parseCreditCount(ocrText);
  const overdue = parseOverdueCount(ocrText);
  const score = parseCreditScore(ocrText);

  // Store report
  const { data: report } = await supabaseAdmin
    .from('credit_reports')
    .insert({
      user_id: userId,
      source: 'ckr_pdf',
      raw_data: { ocr_excerpt: ocrText.slice(0, 1000) },
      credits_count: credits,
      overdue_count: overdue,
      score,
      verified: true,
    })
    .select('id')
    .single();

  // Award index points — official 3.0× weight
  await recordEvent(userId, {
    eventName: 'credit_data_added',
    delta: 18,
    source: 'official',
    pillar: 'financial',
    weight: 3.0,
    metadata: { source: 'ckr_pdf', credits, overdue },
  });

  logger.info({ userId, credits, overdue, score }, 'ЦКР PDF processed');
}

function parseCreditCount(text: string): number {
  const match = text.match(/(?:кредити|credits?)\s*[:\-]\s*(\d+)/i);
  return match ? parseInt(match[1]) : 0;
}

function parseOverdueCount(text: string): number {
  const match = text.match(/(?:просрочени|overdue|забавени)\s*[:\-]\s*(\d+)/i);
  return match ? parseInt(match[1]) : 0;
}

function parseCreditScore(text: string): number | null {
  const match = text.match(/(?:score|рейтинг|оценка)\s*[:\-]\s*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}
