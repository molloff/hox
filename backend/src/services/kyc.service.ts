import { createHmac } from 'node:crypto';
import { onfido } from '../config/onfido.js';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { hashEgn } from './egn.service.js';
import { createUserKey } from './vault.service.js';
import { bus } from './bus.service.js';
import { logger } from '../utils/logger.js';

interface StartKycResult {
  sdkToken: string;
  applicantId: string;
}

/**
 * Create an Onfido applicant and generate an SDK token for the mobile app.
 * The mobile Onfido SDK uploads ID photos directly to Onfido — never to HOX.
 */
export async function startKyc(userId: string, firstName: string, lastName: string): Promise<StartKycResult> {
  const { data: applicant } = await onfido.createApplicant({
    first_name: firstName,
    last_name: lastName,
  });

  // Store applicant ID on user row
  await supabaseAdmin
    .from('users')
    .update({
      onfido_applicant_id: applicant.id,
      kyc_status: 'document_uploaded',
    })
    .eq('id', userId);

  const { data: sdkToken } = await onfido.generateSdkToken({
    applicant_id: applicant.id,
    referrer: '*',
  });

  // Log event
  await supabaseAdmin.from('events').insert({
    user_id: userId,
    type: 'kyc_started',
    payload: { applicant_id: applicant.id },
  });

  logger.info({ userId, applicantId: applicant.id }, 'KYC started');

  return { sdkToken: sdkToken.token, applicantId: applicant.id };
}

/**
 * Verify the HMAC-SHA256 signature of an Onfido webhook request.
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const hmac = createHmac('sha256', env.ONFIDO_WEBHOOK_SECRET);
  hmac.update(rawBody);
  const expected = hmac.digest('hex');
  return expected === signature;
}

/**
 * Process an Onfido webhook callback.
 * On successful verification:
 * 1. Hash EGN from document report
 * 2. Create per-user Vault encryption key
 * 3. Mark user as verified
 * 4. Emit user_verified event
 */
export async function handleWebhook(checkId: string): Promise<void> {
  const { data: check } = await onfido.findCheck(checkId);

  // Find user by Onfido applicant ID
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('onfido_applicant_id', check.applicant_id)
    .single();

  if (error || !user) {
    logger.error({ checkId, applicantId: check.applicant_id }, 'User not found for Onfido check');
    return;
  }

  const userId = user.id;

  if (check.result === 'clear') {
    // Extract EGN from document report
    const { data: reports } = await onfido.listReports(checkId);
    const reportList = (reports as unknown as any[]);
    const docReport = reportList.find((r: any) => r.name === 'document');
    let egnHash: string | null = null;

    if (docReport) {
      const { data: fullReport } = await onfido.findReport(docReport.id);
      const properties = (fullReport as any).properties as Record<string, unknown> | undefined;
      const personalNumber = properties?.personal_number as string | undefined;

      if (personalNumber) {
        // Hash EGN immediately, wipe from memory
        egnHash = await hashEgn(personalNumber);
      }
    }

    // Create Vault encryption key for this user
    await createUserKey(userId);

    // Update user as verified
    await supabaseAdmin
      .from('users')
      .update({
        kyc_status: 'verified',
        egn_hash: egnHash,
        is_verified: true,
      })
      .eq('id', userId);

    // Log events
    await supabaseAdmin.from('events').insert([
      { user_id: userId, type: 'kyc_verified', payload: { check_id: checkId } },
      { user_id: userId, type: 'vault_key_created', payload: {} },
      { user_id: userId, type: 'user_verified', payload: {} },
    ]);

    // Emit — activates Vault, Pay, Deal, Connect
    bus.emit('user_verified', { userId });

    logger.info({ userId, checkId }, 'User KYC verified');
  } else {
    // Rejected
    await supabaseAdmin
      .from('users')
      .update({ kyc_status: 'rejected' })
      .eq('id', userId);

    await supabaseAdmin.from('events').insert({
      user_id: userId,
      type: 'kyc_rejected',
      payload: { check_id: checkId, result: check.result },
    });

    logger.warn({ userId, checkId, result: check.result }, 'User KYC rejected');
  }
}

/**
 * Get the current KYC status for a user.
 */
export async function getKycStatus(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('kyc_status')
    .eq('id', userId)
    .single();

  return data?.kyc_status ?? 'pending';
}
