-- Voice recordings metadata (audio stored encrypted in S3)
CREATE TABLE public.voice_recordings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vault_file_id   UUID REFERENCES public.vault_files(id) ON DELETE SET NULL,
    duration_ms     INTEGER NOT NULL,
    transcript      TEXT,
    transcript_status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, done, failed
    language        TEXT NOT NULL DEFAULT 'bg',
    ai_summary      TEXT,
    ai_tags         TEXT[] DEFAULT '{}',
    ai_mood         TEXT,                               -- detected mood/sentiment
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_recordings_user ON public.voice_recordings(user_id);
CREATE INDEX idx_voice_recordings_created ON public.voice_recordings(created_at);
CREATE INDEX idx_voice_recordings_transcript ON public.voice_recordings
    USING gin(to_tsvector('simple', coalesce(transcript, '')));

ALTER TABLE public.voice_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_recordings_own" ON public.voice_recordings
    FOR ALL USING (user_id = public.current_user_id())
    WITH CHECK (user_id = public.current_user_id());
