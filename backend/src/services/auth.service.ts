import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import type { UserRow } from '../types/models.js';

export async function sendOtp(phone: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.signInWithOtp({ phone });
  if (error) {
    logger.error({ phone: phone.slice(0, 7) + '***', error: error.message }, 'OTP send failed');
    throw new Error(`OTP send failed: ${error.message}`);
  }
  logger.info({ phone: phone.slice(0, 7) + '***' }, 'OTP sent');
}

interface VerifyOtpResult {
  accessToken: string;
  refreshToken: string;
  user: UserRow;
  isNewUser: boolean;
}

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const { data: session, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
    phone,
    token: code,
    type: 'sms',
  });

  if (verifyError || !session.session) {
    throw new Error(`OTP verification failed: ${verifyError?.message || 'No session returned'}`);
  }

  const authId = session.user!.id;
  const accessToken = session.session.access_token;
  const refreshToken = session.session.refresh_token;

  // Check if user row exists
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .single();

  if (existing) {
    // Log event
    await supabaseAdmin.from('events').insert({
      user_id: existing.id,
      type: 'otp_verified',
      payload: {},
    });

    return { accessToken, refreshToken, user: existing as UserRow, isNewUser: false };
  }

  // Create new user row
  const { data: newUser, error: insertError } = await supabaseAdmin
    .from('users')
    .insert({ auth_id: authId, phone })
    .select('*')
    .single();

  if (insertError || !newUser) {
    throw new Error(`Failed to create user: ${insertError?.message}`);
  }

  // Log events
  await supabaseAdmin.from('events').insert([
    { user_id: newUser.id, type: 'otp_verified', payload: {} },
  ]);

  logger.info({ userId: newUser.id }, 'New user created');
  return { accessToken, refreshToken, user: newUser as UserRow, isNewUser: true };
}
