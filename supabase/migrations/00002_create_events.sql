CREATE TYPE event_type AS ENUM (
    'otp_sent',
    'otp_verified',
    'kyc_started',
    'document_uploaded',
    'liveness_completed',
    'kyc_verified',
    'kyc_rejected',
    'profile_updated',
    'vault_key_created',
    'user_verified'
);

CREATE TABLE public.events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type       event_type NOT NULL,
    payload    JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_user_id ON public.events(user_id);
CREATE INDEX idx_events_type ON public.events(type);
CREATE INDEX idx_events_created_at ON public.events(created_at);
