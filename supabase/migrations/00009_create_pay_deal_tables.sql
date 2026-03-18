-- ===== PAY MODULE =====

CREATE TYPE bill_status AS ENUM ('pending', 'upcoming', 'overdue', 'paid', 'failed');
CREATE TYPE bill_source AS ENUM ('epay', 'gmail', 'nordigen', 'manual', 'nap', 'kat', 'egov');

CREATE TYPE obligation_type AS ENUM (
    'tax_income', 'tax_vat', 'tax_property', 'tax_vehicle',
    'tax_dog', 'social_insurance', 'health_insurance',
    'fine_kat', 'fine_other', 'municipal'
);

-- Bills — utility payments (ePay, Gmail parsed)
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS merchant_id TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS paid_via TEXT;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS index_points NUMERIC(6,2) DEFAULT 0;

-- Obligations — government (НАП, КАТ, pay.egov.bg)
CREATE TABLE public.obligations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type            obligation_type NOT NULL,
    title           TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'BGN',
    status          bill_status NOT NULL DEFAULT 'pending',
    source          bill_source NOT NULL,
    reference_id    TEXT,                       -- external reference (НАП ID, КАТ фиш номер)
    due_date        DATE,
    paid_at         TIMESTAMPTZ,
    paid_via        TEXT,
    index_points    NUMERIC(6,2) DEFAULT 0,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_obligations_updated_at
    BEFORE UPDATE ON public.obligations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_obligations_user ON public.obligations(user_id);
CREATE INDEX idx_obligations_status ON public.obligations(status);
CREATE INDEX idx_obligations_due ON public.obligations(due_date);
CREATE INDEX idx_obligations_type ON public.obligations(type);

-- Gmail white-list providers
CREATE TABLE public.gmail_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain          TEXT NOT NULL UNIQUE,
    provider_name   TEXT NOT NULL,
    category        TEXT NOT NULL,              -- electricity, water, heating, internet, mobile
    merchant_id     TEXT,                       -- ePay merchant ID if applicable
    amount_regex    TEXT,                       -- regex to extract amount from subject
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed known Bulgarian providers
INSERT INTO public.gmail_providers (domain, provider_name, category, amount_regex) VALUES
    ('cez.bg', 'ЧЕЗ', 'electricity', '(\d+[.,]\d{2})\s*лв'),
    ('evn.bg', 'ЕВН', 'electricity', '(\d+[.,]\d{2})\s*лв'),
    ('energo-pro.bg', 'Енерго-Про', 'electricity', '(\d+[.,]\d{2})\s*лв'),
    ('vivacom.bg', 'Виваком', 'internet', '(\d+[.,]\d{2})\s*лв'),
    ('a1.bg', 'A1', 'mobile', '(\d+[.,]\d{2})\s*лв'),
    ('yettel.bg', 'Yettel', 'mobile', '(\d+[.,]\d{2})\s*лв'),
    ('toplo.bg', 'Топлофикация София', 'heating', '(\d+[.,]\d{2})\s*лв'),
    ('sofiyskavoda.bg', 'Софийска вода', 'water', '(\d+[.,]\d{2})\s*лв');

-- ===== DEAL MODULE =====

CREATE TYPE deal_status AS ENUM (
    'draft', 'pending_signature', 'signed',
    'escrow_held', 'completed', 'disputed', 'refunded', 'cancelled'
);

CREATE TYPE deal_template AS ENUM (
    'rent', 'service', 'nda', 'sale', 'protocol', 'offer', 'custom'
);

CREATE TYPE signature_type AS ENUM ('simple', 'kep');

CREATE TABLE public.deals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    counterparty_id     UUID REFERENCES public.users(id),
    status              deal_status NOT NULL DEFAULT 'draft',
    template            deal_template NOT NULL DEFAULT 'custom',
    title               TEXT NOT NULL,
    description         TEXT DEFAULT '',
    amount              NUMERIC(12,2),
    currency            TEXT NOT NULL DEFAULT 'BGN',
    signature_type      signature_type NOT NULL DEFAULT 'simple',
    -- Stripe
    stripe_payment_intent_id TEXT,
    stripe_capture_status    TEXT DEFAULT 'none',  -- none, authorized, captured, refunded
    -- Evrotrust
    evrotrust_doc_id    TEXT,
    evrotrust_status    TEXT,
    -- Signatures
    creator_signed_at   TIMESTAMPTZ,
    counter_signed_at   TIMESTAMPTZ,
    -- Contract document
    contract_vault_file_id UUID REFERENCES public.vault_files(id),
    -- Idempotency
    idempotency_key     TEXT UNIQUE,
    -- Timing
    expires_at          TIMESTAMPTZ,             -- QR code / offer expiry
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_deals_updated_at
    BEFORE UPDATE ON public.deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_deals_creator ON public.deals(creator_id);
CREATE INDEX idx_deals_counterparty ON public.deals(counterparty_id);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deals_idempotency ON public.deals(idempotency_key);

-- Deal events / history
CREATE TABLE public.deal_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id     UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES public.users(id),
    action      TEXT NOT NULL,
    payload     JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_events_deal ON public.deal_events(deal_id);

-- RLS
ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obligations_select_own" ON public.obligations
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "obligations_insert_own" ON public.obligations
    FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "obligations_update_own" ON public.obligations
    FOR UPDATE USING (user_id = public.current_user_id());

-- Deals: both creator and counterparty can see
CREATE POLICY "deals_select_participant" ON public.deals
    FOR SELECT USING (
        creator_id = public.current_user_id()
        OR counterparty_id = public.current_user_id()
    );
CREATE POLICY "deals_insert_creator" ON public.deals
    FOR INSERT WITH CHECK (creator_id = public.current_user_id());
CREATE POLICY "deals_update_participant" ON public.deals
    FOR UPDATE USING (
        creator_id = public.current_user_id()
        OR counterparty_id = public.current_user_id()
    );

CREATE POLICY "deal_events_select" ON public.deal_events
    FOR SELECT USING (deal_id IN (
        SELECT id FROM public.deals
        WHERE creator_id = public.current_user_id()
           OR counterparty_id = public.current_user_id()
    ));
CREATE POLICY "deal_events_insert" ON public.deal_events
    FOR INSERT WITH CHECK (deal_id IN (
        SELECT id FROM public.deals
        WHERE creator_id = public.current_user_id()
           OR counterparty_id = public.current_user_id()
    ));
