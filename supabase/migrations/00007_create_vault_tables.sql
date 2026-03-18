-- Vault file entries (encrypted files stored in S3)
CREATE TYPE vault_category AS ENUM (
    'documents', 'receipts', 'warranties', 'health',
    'children', 'pets', 'diary', 'contracts', 'certificates'
);

CREATE TABLE public.vault_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category        vault_category NOT NULL,
    title           TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    size_bytes      INTEGER NOT NULL,
    s3_key          TEXT NOT NULL,
    iv              TEXT NOT NULL,              -- AES-256-GCM IV (hex)
    auth_tag        TEXT NOT NULL,              -- AES-256-GCM auth tag (hex)
    ocr_text        TEXT,                       -- extracted text from Textract
    ocr_status      TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, done, failed
    expires_at      DATE,                       -- document expiry (ID card, warranty, etc.)
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_vault_files_updated_at
    BEFORE UPDATE ON public.vault_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_vault_files_user_id ON public.vault_files(user_id);
CREATE INDEX idx_vault_files_category ON public.vault_files(category);
CREATE INDEX idx_vault_files_expires_at ON public.vault_files(expires_at);
CREATE INDEX idx_vault_files_ocr_text ON public.vault_files USING gin(to_tsvector('simple', coalesce(ocr_text, '')));

-- pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.vault_embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_file_id   UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    embedding       vector(1536),               -- OpenAI ada-002 dimension
    chunk_text      TEXT NOT NULL,
    chunk_index     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_embeddings_user ON public.vault_embeddings(user_id);
CREATE INDEX idx_vault_embeddings_file ON public.vault_embeddings(vault_file_id);
CREATE INDEX idx_vault_embeddings_vector ON public.vault_embeddings
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- QR share links
CREATE TABLE public.vault_shares (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vault_file_id   UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,        -- JWT or opaque token
    scope           TEXT[] NOT NULL DEFAULT '{"read"}',
    expires_at      TIMESTAMPTZ NOT NULL,
    max_views       INTEGER DEFAULT 1,
    view_count      INTEGER NOT NULL DEFAULT 0,
    is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_shares_token ON public.vault_shares(token);
CREATE INDEX idx_vault_shares_user ON public.vault_shares(user_id);

-- Audit log for share access
CREATE TABLE public.vault_audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_share_id  UUID NOT NULL REFERENCES public.vault_shares(id) ON DELETE CASCADE,
    vault_file_id   UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
    accessor_ip     TEXT,
    accessor_ua     TEXT,
    action          TEXT NOT NULL DEFAULT 'view',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vault_audit_share ON public.vault_audit_log(vault_share_id);
CREATE INDEX idx_vault_audit_file ON public.vault_audit_log(vault_file_id);

-- RLS
ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vault_files_select_own" ON public.vault_files
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "vault_files_insert_own" ON public.vault_files
    FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "vault_files_update_own" ON public.vault_files
    FOR UPDATE USING (user_id = public.current_user_id());
CREATE POLICY "vault_files_delete_own" ON public.vault_files
    FOR DELETE USING (user_id = public.current_user_id());

CREATE POLICY "vault_embeddings_select_own" ON public.vault_embeddings
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "vault_embeddings_insert_own" ON public.vault_embeddings
    FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "vault_embeddings_delete_own" ON public.vault_embeddings
    FOR DELETE USING (user_id = public.current_user_id());

CREATE POLICY "vault_shares_select_own" ON public.vault_shares
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "vault_shares_insert_own" ON public.vault_shares
    FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "vault_shares_update_own" ON public.vault_shares
    FOR UPDATE USING (user_id = public.current_user_id());

CREATE POLICY "vault_audit_select_own" ON public.vault_audit_log
    FOR SELECT USING (vault_file_id IN (
        SELECT id FROM public.vault_files WHERE user_id = public.current_user_id()
    ));
