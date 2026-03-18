-- ===== INDEX MODULE =====
-- Score is NOT stored as a column — computed on-the-fly from events.
-- This table stores the raw index events that feed the formula.

CREATE TYPE index_source AS ENUM ('official', 'system', 'verified', 'self');
CREATE TYPE index_pillar AS ENUM ('financial', 'behavioral', 'physical', 'civic');

CREATE TABLE public.index_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_name  TEXT NOT NULL,
    delta       NUMERIC(8,2) NOT NULL,
    source      index_source NOT NULL,
    pillar      index_pillar NOT NULL,
    weight      NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    capped      BOOLEAN NOT NULL DEFAULT FALSE,
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_index_events_user ON public.index_events(user_id);
CREATE INDEX idx_index_events_created ON public.index_events(created_at);
CREATE INDEX idx_index_events_pillar ON public.index_events(pillar);

-- Daily cap tracking — prevents manipulation
CREATE TABLE public.index_daily_caps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_name  TEXT NOT NULL,
    cap_date    DATE NOT NULL,
    total_delta NUMERIC(8,2) NOT NULL DEFAULT 0,
    UNIQUE(user_id, event_name, cap_date)
);

CREATE INDEX idx_daily_caps_user_date ON public.index_daily_caps(user_id, cap_date);

-- ЦКР (Central Credit Register) data
CREATE TABLE public.credit_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source          TEXT NOT NULL,       -- 'ckr_pdf', 'nbki_api', 'ckr_pi'
    raw_data        JSONB DEFAULT '{}',
    credits_count   INTEGER DEFAULT 0,
    overdue_count   INTEGER DEFAULT 0,
    score           INTEGER,
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_reports_user ON public.credit_reports(user_id);

-- ===== CONNECT MODULE =====

-- Conversations (E2E encrypted — HOX stores only ciphertext)
CREATE TABLE public.conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_a   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    participant_b   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(participant_a, participant_b)
);

CREATE INDEX idx_conversations_a ON public.conversations(participant_a);
CREATE INDEX idx_conversations_b ON public.conversations(participant_b);

-- Messages (E2E encrypted — only ciphertext stored)
CREATE TABLE public.messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES public.users(id),
    ciphertext      TEXT NOT NULL,          -- encrypted message body
    nonce           TEXT NOT NULL,           -- encryption nonce
    message_type    TEXT NOT NULL DEFAULT 'text',  -- text, file, deal_invite
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_created ON public.messages(created_at);

-- Signal Protocol key bundles (X3DH)
CREATE TABLE public.key_bundles (
    user_id             UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    identity_key        TEXT NOT NULL,      -- long-term identity public key
    signed_prekey       TEXT NOT NULL,      -- signed pre-key public
    signed_prekey_sig   TEXT NOT NULL,      -- signature over signed pre-key
    prekey_id           INTEGER NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One-time pre-keys (consumed on first contact)
CREATE TABLE public.one_time_prekeys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    key_id      INTEGER NOT NULL,
    public_key  TEXT NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otpk_user ON public.one_time_prekeys(user_id);
CREATE INDEX idx_otpk_available ON public.one_time_prekeys(user_id, used) WHERE NOT used;

-- Search index for Connect marketplace
CREATE TABLE public.search_profiles (
    user_id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    display_name    TEXT,
    skills          TEXT[] DEFAULT '{}',
    description     TEXT DEFAULT '',
    profile_type    TEXT,
    hox_score       NUMERIC(6,2) DEFAULT 0,
    is_verified     BOOLEAN DEFAULT FALSE,
    location        TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_skills ON public.search_profiles USING gin(skills);
CREATE INDEX idx_search_score ON public.search_profiles(hox_score DESC);
CREATE INDEX idx_search_verified ON public.search_profiles(is_verified) WHERE is_verified = TRUE;

-- RLS
ALTER TABLE public.index_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_daily_caps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_time_prekeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_profiles ENABLE ROW LEVEL SECURITY;

-- Index: own data only
CREATE POLICY "index_events_select_own" ON public.index_events
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "index_daily_caps_select_own" ON public.index_daily_caps
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "credit_reports_select_own" ON public.credit_reports
    FOR SELECT USING (user_id = public.current_user_id());

-- Conversations: both participants
CREATE POLICY "conversations_select" ON public.conversations
    FOR SELECT USING (
        participant_a = public.current_user_id()
        OR participant_b = public.current_user_id()
    );
CREATE POLICY "conversations_insert" ON public.conversations
    FOR INSERT WITH CHECK (
        participant_a = public.current_user_id()
        OR participant_b = public.current_user_id()
    );

-- Messages: conversation participants only
CREATE POLICY "messages_select" ON public.messages
    FOR SELECT USING (conversation_id IN (
        SELECT id FROM public.conversations
        WHERE participant_a = public.current_user_id()
           OR participant_b = public.current_user_id()
    ));
CREATE POLICY "messages_insert" ON public.messages
    FOR INSERT WITH CHECK (sender_id = public.current_user_id());

-- Key bundles: own write, public read (needed for X3DH)
CREATE POLICY "key_bundles_select_all" ON public.key_bundles FOR SELECT USING (true);
CREATE POLICY "key_bundles_upsert_own" ON public.key_bundles
    FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "key_bundles_update_own" ON public.key_bundles
    FOR UPDATE USING (user_id = public.current_user_id());

-- One-time prekeys: own write, public consume
CREATE POLICY "otpk_select_all" ON public.one_time_prekeys FOR SELECT USING (true);
CREATE POLICY "otpk_insert_own" ON public.one_time_prekeys
    FOR INSERT WITH CHECK (user_id = public.current_user_id());

-- Search profiles: public read, own write
CREATE POLICY "search_profiles_select_all" ON public.search_profiles FOR SELECT USING (true);
CREATE POLICY "search_profiles_upsert_own" ON public.search_profiles
    FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "search_profiles_update_own" ON public.search_profiles
    FOR UPDATE USING (user_id = public.current_user_id());
