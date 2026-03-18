import api from './api';

export interface Notification {
  id: string;
  category: string;
  channel: string;
  priority: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  morning_briefing: boolean;
  briefing_time: string;
  bill_reminders: boolean;
  bill_reminder_days: number;
  obligation_alerts: boolean;
  document_expiry: boolean;
  deal_updates: boolean;
  connect_messages: boolean;
  medication_reminders: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export async function registerPushToken(token: string, platform: string): Promise<void> {
  await api.post('/notifications/token', { token, platform });
}

export async function listNotifications(limit = 50, unreadOnly = false): Promise<Notification[]> {
  const { data } = await api.get('/notifications', { params: { limit, unread: unreadOnly } });
  return data.notifications;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  return data.count;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await api.post(`/notifications/${notificationId}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}

export async function getPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get('/notifications/preferences');
  return data;
}

export async function updatePreferences(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const { data } = await api.patch('/notifications/preferences', prefs);
  return data;
}
