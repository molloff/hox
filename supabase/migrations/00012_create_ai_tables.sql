-- AI conversation history (per user)
CREATE TABLE public.ai_conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_ai_conversations_updated
    BEFORE UPDATE ON public.ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(user_id);

-- AI messages
CREATE TYPE ai_role AS ENUM ('user', 'assistant', 'system');

CREATE TABLE public.ai_messages (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    role                ai_role NOT NULL,
    content             TEXT NOT NULL,
    tool_calls          JSONB DEFAULT '[]',     -- function calls made by AI
    tool_results        JSONB DEFAULT '[]',     -- results from function calls
    tokens_used         INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_messages_conversation ON public.ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_created ON public.ai_messages(created_at);

-- AI action log — what the AI did on behalf of the user
CREATE TABLE public.ai_actions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.ai_conversations(id),
    action_type     TEXT NOT NULL,          -- 'vault_search', 'bill_summary', 'deal_draft', etc.
    input           JSONB DEFAULT '{}',
    output          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_actions_user ON public.ai_actions(user_id);

-- RLS
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_own" ON public.ai_conversations
    FOR ALL USING (user_id = public.current_user_id())
    WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "ai_messages_own" ON public.ai_messages
    FOR ALL USING (conversation_id IN (
        SELECT id FROM public.ai_conversations WHERE user_id = public.current_user_id()
    ))
    WITH CHECK (conversation_id IN (
        SELECT id FROM public.ai_conversations WHERE user_id = public.current_user_id()
    ));

CREATE POLICY "ai_actions_own" ON public.ai_actions
    FOR ALL USING (user_id = public.current_user_id())
    WITH CHECK (user_id = public.current_user_id());
