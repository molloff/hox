import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import type { SearchProfile, ConversationWithProfile } from '../types/connect.js';

/**
 * Connect module — E2E encrypted chat + marketplace search.
 *
 * Signal Protocol: Double Ratchet + X3DH key exchange.
 * HOX sees ONLY ciphertext — never plaintext.
 * Keys live on the device, not on the server.
 */

// ===== SEARCH / MARKETPLACE =====

/**
 * Search for verified users by skill/category, ordered by HOX Score.
 * "Електротехник" → verified people sorted by trust score.
 */
export async function searchBySkill(
  query: string,
  limit = 20,
  offset = 0
): Promise<SearchProfile[]> {
  const { data, error } = await supabaseAdmin
    .from('search_profiles')
    .select('*')
    .eq('is_verified', true)
    .or(`skills.cs.{${query}},description.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order('hox_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(error.message);
  return (data || []) as SearchProfile[];
}

/**
 * Get a user's public search profile (visible in chat header).
 */
export async function getPublicProfile(userId: string): Promise<SearchProfile | null> {
  const { data } = await supabaseAdmin
    .from('search_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  return data as SearchProfile | null;
}

// ===== KEY EXCHANGE (X3DH) =====

/**
 * Upload or update a user's key bundle for Signal Protocol.
 */
export async function upsertKeyBundle(
  userId: string,
  bundle: {
    identityKey: string;
    signedPrekey: string;
    signedPrekeySig: string;
    prekeyId: number;
  }
): Promise<void> {
  await supabaseAdmin.from('key_bundles').upsert({
    user_id: userId,
    identity_key: bundle.identityKey,
    signed_prekey: bundle.signedPrekey,
    signed_prekey_sig: bundle.signedPrekeySig,
    prekey_id: bundle.prekeyId,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Upload one-time pre-keys (batch).
 */
export async function uploadOneTimePrekeys(
  userId: string,
  keys: { keyId: number; publicKey: string }[]
): Promise<void> {
  const rows = keys.map((k) => ({
    user_id: userId,
    key_id: k.keyId,
    public_key: k.publicKey,
    used: false,
  }));

  await supabaseAdmin.from('one_time_prekeys').insert(rows);
}

/**
 * Fetch another user's key bundle for initiating X3DH.
 * Consumes one one-time pre-key.
 */
export async function fetchKeyBundle(targetUserId: string): Promise<{
  identityKey: string;
  signedPrekey: string;
  signedPrekeySig: string;
  oneTimePrekey?: string;
}> {
  const { data: bundle } = await supabaseAdmin
    .from('key_bundles')
    .select('*')
    .eq('user_id', targetUserId)
    .single();

  if (!bundle) throw new Error('User has no key bundle');

  // Consume one one-time pre-key
  const { data: otpk } = await supabaseAdmin
    .from('one_time_prekeys')
    .select('id, public_key')
    .eq('user_id', targetUserId)
    .eq('used', false)
    .limit(1)
    .single();

  if (otpk) {
    await supabaseAdmin
      .from('one_time_prekeys')
      .update({ used: true })
      .eq('id', otpk.id);
  }

  return {
    identityKey: bundle.identity_key,
    signedPrekey: bundle.signed_prekey,
    signedPrekeySig: bundle.signed_prekey_sig,
    oneTimePrekey: otpk?.public_key,
  };
}

// ===== CONVERSATIONS =====

/**
 * Create or get existing conversation between two users.
 */
export async function getOrCreateConversation(
  userA: string,
  userB: string
): Promise<string> {
  // Normalize order
  const [a, b] = [userA, userB].sort();

  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('participant_a', a)
    .eq('participant_b', b)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from('conversations')
    .insert({ participant_a: a, participant_b: b })
    .select('id')
    .single();

  if (error || !created) throw new Error(`Failed to create conversation: ${error?.message}`);

  logger.info({ userA, userB, conversationId: created.id }, 'Conversation created');
  return created.id;
}

/**
 * Send an encrypted message.
 * HOX stores ONLY ciphertext — never plaintext.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  ciphertext: string,
  nonce: string,
  messageType = 'text',
  metadata: Record<string, unknown> = {}
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      ciphertext,
      nonce,
      message_type: messageType,
      metadata,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`Failed to send message: ${error?.message}`);

  // Update last_message_at
  await supabaseAdmin
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data.id;
}

/**
 * Get messages for a conversation (paginated).
 * Returns ciphertext — decryption happens on device.
 */
export async function getMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<any[]> {
  let query = supabaseAdmin
    .from('messages')
    .select('id, sender_id, ciphertext, nonce, message_type, metadata, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * List conversations for a user with last message and other user's profile.
 */
export async function listConversations(userId: string): Promise<ConversationWithProfile[]> {
  const { data: convos } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (!convos || convos.length === 0) return [];

  const result: ConversationWithProfile[] = [];

  for (const convo of convos) {
    const otherId = convo.participant_a === userId ? convo.participant_b : convo.participant_a;

    // Get other user's profile
    const profile = await getPublicProfile(otherId);

    // Get last message
    const { data: lastMsg } = await supabaseAdmin
      .from('messages')
      .select('ciphertext, created_at, sender_id')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    result.push({
      conversation: convo,
      otherUser: profile || {
        user_id: otherId,
        display_name: null,
        skills: [],
        description: '',
        profile_type: null,
        hox_score: 0,
        is_verified: false,
        location: null,
      },
      lastMessage: lastMsg || undefined,
    });
  }

  return result;
}
