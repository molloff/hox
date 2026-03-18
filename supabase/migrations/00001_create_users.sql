CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE profile_type AS ENUM ('family', 'freelancer', 'small_business');
CREATE TYPE kyc_status AS ENUM ('pending', 'document_uploaded', 'liveness_done', 'verified', 'rejected');

CREATE TABLE public.users (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id              UUID NOT NULL UNIQUE,
    phone                TEXT NOT NULL UNIQUE,
    egn_hash             TEXT,
    kyc_status           kyc_status NOT NULL DEFAULT 'pending',
    onfido_applicant_id  TEXT,
    profile_type         profile_type,
    display_name         TEXT,
    skills               TEXT[] DEFAULT '{}',
    description          TEXT DEFAULT '',
    company_name         TEXT,
    eik                  TEXT,
    vault_key_id         TEXT,
    is_verified          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_auth_id ON public.users(auth_id);
CREATE INDEX idx_users_phone ON public.users(phone);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
