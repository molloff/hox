import { supabaseAdmin } from '../config/supabase.js';
import type { UserRow } from '../types/models.js';
import type { UpdateProfileInput } from '../schemas/profile.schema.js';
import { logger } from '../utils/logger.js';

export async function getProfile(userId: string): Promise<UserRow> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new Error('Profile not found');
  }

  return data as UserRow;
}

export async function updateProfile(userId: string, updates: UpdateProfileInput): Promise<UserRow> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`Profile update failed: ${error?.message}`);
  }

  // Log event
  await supabaseAdmin.from('events').insert({
    user_id: userId,
    type: 'profile_updated',
    payload: { fields: Object.keys(updates) },
  });

  logger.info({ userId, fields: Object.keys(updates) }, 'Profile updated');
  return data as UserRow;
}
