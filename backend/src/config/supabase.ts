import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service-role client — bypasses RLS. Use ONLY for:
// 1. Creating user rows on first OTP verification
// 2. Processing Onfido webhooks (KYC status updates)
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Per-request client with user's JWT — subject to RLS
export function createUserClient(jwt: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
