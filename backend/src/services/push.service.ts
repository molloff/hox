import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import type { NotificationPayload } from '../types/notifications.js';

const expo = new Expo();

/**
 * Register a device push token.
 */
export async function registerToken(userId: string, token: string, platform: string): Promise<void> {
  if (!Expo.isExpoPushToken(token)) {
    throw new Error('Invalid Expo push token');
  }

  await supabaseAdmin.from('push_tokens').upsert(
    { user_id: userId, token, platform, is_active: true, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,token' }
  );

  logger.info({ userId, platform }, 'Push token registered');
}

/**
 * Unregister a device push token.
 */
export async function unregisterToken(userId: string, token: string): Promise<void> {
  await supabaseAdmin
    .from('push_tokens')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('token', token);
}

/**
 * Send a push notification to a user's devices.
 * Also stores in notifications table for in-app history.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  // Check user preferences
  const { data: prefs } = await supabaseAdmin
    .from('notification_preferences')
    .select('*')
    .eq('user_id', payload.userId)
    .single();

  if (prefs && !prefs.push_enabled) {
    // Still store in-app, just don't push
    await storeNotification(payload, 'in_app');
    return;
  }

  // Check quiet hours
  if (prefs?.quiet_hours_start && prefs?.quiet_hours_end) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    if (currentTime >= prefs.quiet_hours_start || currentTime < prefs.quiet_hours_end) {
      if (payload.priority !== 'critical') {
        await storeNotification(payload, 'in_app');
        return;
      }
    }
  }

  // Check category-specific preferences
  if (prefs) {
    const categoryEnabled = checkCategoryPreference(payload.category, prefs);
    if (!categoryEnabled) {
      await storeNotification(payload, 'in_app');
      return;
    }
  }

  // Get active push tokens
  const { data: tokens } = await supabaseAdmin
    .from('push_tokens')
    .select('token')
    .eq('user_id', payload.userId)
    .eq('is_active', true);

  if (!tokens || tokens.length === 0) {
    await storeNotification(payload, 'in_app');
    return;
  }

  // Build messages
  const messages: ExpoPushMessage[] = tokens.map((t) => ({
    to: t.token,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    priority: payload.priority === 'critical' ? 'high' : 'default',
    sound: payload.priority === 'critical' ? 'default' : undefined,
    badge: 1,
  }));

  // Send in chunks
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (err) {
      logger.error({ userId: payload.userId, err }, 'Push send failed');
    }
  }

  // Deactivate invalid tokens
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      await supabaseAdmin
        .from('push_tokens')
        .update({ is_active: false })
        .eq('token', tokens[i].token);
    }
  }

  await storeNotification(payload, 'push');
  logger.info({ userId: payload.userId, category: payload.category, devices: tokens.length }, 'Push sent');
}

/**
 * Send push to multiple users.
 */
export async function sendBulkNotification(
  userIds: string[],
  notification: Omit<NotificationPayload, 'userId'>
): Promise<void> {
  for (const userId of userIds) {
    await sendNotification({ ...notification, userId });
  }
}

function checkCategoryPreference(category: string, prefs: any): boolean {
  const mapping: Record<string, string> = {
    bill_reminder: 'bill_reminders',
    bill_overdue: 'bill_reminders',
    obligation_detected: 'obligation_alerts',
    obligation_reminder: 'obligation_alerts',
    document_expiry: 'document_expiry',
    deal_update: 'deal_updates',
    deal_signature: 'deal_updates',
    deal_completed: 'deal_updates',
    connect_message: 'connect_messages',
    morning_briefing: 'morning_briefing',
    medication_reminder: 'medication_reminders',
    vaccination_reminder: 'medication_reminders',
  };
  const prefKey = mapping[category];
  if (!prefKey) return true;
  return prefs[prefKey] !== false;
}

async function storeNotification(payload: NotificationPayload, channel: string): Promise<void> {
  await supabaseAdmin.from('notifications').insert({
    user_id: payload.userId,
    category: payload.category,
    channel,
    priority: payload.priority || 'normal',
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    sent_at: new Date().toISOString(),
  });
}
