export type NotificationChannel = 'push' | 'in_app' | 'sms';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationCategory =
  | 'bill_reminder' | 'bill_overdue' | 'obligation_detected' | 'obligation_reminder'
  | 'document_expiry' | 'deal_update' | 'deal_signature' | 'deal_completed'
  | 'kyc_update' | 'index_update' | 'connect_message' | 'system'
  | 'morning_briefing' | 'medication_reminder' | 'vaccination_reminder';

export interface NotificationPayload {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  priority?: NotificationPriority;
  data?: Record<string, unknown>;
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

export interface MorningBriefing {
  unpaidBills: number;
  overdueBills: number;
  upcomingObligations: number;
  expiringDocuments: number;
  hoxScore: number;
  pendingDeals: number;
}
