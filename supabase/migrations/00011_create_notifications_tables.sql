-- Push notification tokens (per device)
CREATE TABLE public.push_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token       TEXT NOT NULL,
    platform    TEXT NOT NULL,          -- 'ios', 'android'
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, token)
);

CREATE INDEX idx_push_tokens_user ON public.push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON public.push_tokens(user_id, is_active) WHERE is_active = TRUE;

-- Notification log
CREATE TYPE notification_channel AS ENUM ('push', 'in_app', 'sms');
CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE notification_category AS ENUM (
    'bill_reminder', 'bill_overdue', 'obligation_detected', 'obligation_reminder',
    'document_expiry', 'deal_update', 'deal_signature', 'deal_completed',
    'kyc_update', 'index_update', 'connect_message', 'system',
    'morning_briefing', 'medication_reminder', 'vaccination_reminder'
);

CREATE TABLE public.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category        notification_category NOT NULL,
    channel         notification_channel NOT NULL DEFAULT 'push',
    priority        notification_priority NOT NULL DEFAULT 'normal',
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    data            JSONB DEFAULT '{}',         -- deep link payload
    read            BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at         TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read) WHERE NOT read;
CREATE INDEX idx_notifications_category ON public.notifications(category);
CREATE INDEX idx_notifications_created ON public.notifications(created_at);

-- Notification preferences per user
CREATE TABLE public.notification_preferences (
    user_id             UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    push_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
    morning_briefing    BOOLEAN NOT NULL DEFAULT TRUE,
    briefing_time       TIME NOT NULL DEFAULT '07:30',
    bill_reminders      BOOLEAN NOT NULL DEFAULT TRUE,
    bill_reminder_days  INTEGER NOT NULL DEFAULT 3,     -- days before due
    obligation_alerts   BOOLEAN NOT NULL DEFAULT TRUE,
    document_expiry     BOOLEAN NOT NULL DEFAULT TRUE,
    deal_updates        BOOLEAN NOT NULL DEFAULT TRUE,
    connect_messages    BOOLEAN NOT NULL DEFAULT TRUE,
    medication_reminders BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start   TIME DEFAULT '22:00',
    quiet_hours_end     TIME DEFAULT '07:00',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_notification_prefs_updated
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_own" ON public.push_tokens
    FOR ALL USING (user_id = public.current_user_id())
    WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE USING (user_id = public.current_user_id());

CREATE POLICY "notification_prefs_own" ON public.notification_preferences
    FOR ALL USING (user_id = public.current_user_id())
    WITH CHECK (user_id = public.current_user_id());
