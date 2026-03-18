import { z } from 'zod';

export const registerTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    platform: z.enum(['ios', 'android']),
  }),
});

export const updatePreferencesSchema = z.object({
  body: z.object({
    push_enabled: z.boolean().optional(),
    morning_briefing: z.boolean().optional(),
    briefing_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    bill_reminders: z.boolean().optional(),
    bill_reminder_days: z.number().min(1).max(30).optional(),
    obligation_alerts: z.boolean().optional(),
    document_expiry: z.boolean().optional(),
    deal_updates: z.boolean().optional(),
    connect_messages: z.boolean().optional(),
    medication_reminders: z.boolean().optional(),
    quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  }),
});

export const runJobSchema = z.object({
  body: z.object({
    job: z.enum(['morning_briefing', 'bill_reminders', 'obligation_alerts', 'document_expiry', 'nightly_all']),
  }),
});
