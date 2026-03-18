-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Helper: resolve public.users.id from auth.uid()
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS UUID AS $$
    SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ===== USERS =====
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT USING (auth_id = auth.uid());
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE USING (auth_id = auth.uid())
    WITH CHECK (auth_id = auth.uid());
CREATE POLICY "users_insert_own" ON public.users
    FOR INSERT WITH CHECK (auth_id = auth.uid());

-- ===== EVENTS =====
CREATE POLICY "events_select_own" ON public.events
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "events_insert_own" ON public.events
    FOR INSERT WITH CHECK (user_id = public.current_user_id());

-- ===== BILLS =====
CREATE POLICY "bills_select_own" ON public.bills
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "bills_insert_own" ON public.bills
    FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "bills_update_own" ON public.bills
    FOR UPDATE USING (user_id = public.current_user_id());
CREATE POLICY "bills_delete_own" ON public.bills
    FOR DELETE USING (user_id = public.current_user_id());

-- ===== FILES =====
CREATE POLICY "files_select_own" ON public.files
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "files_insert_own" ON public.files
    FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "files_delete_own" ON public.files
    FOR DELETE USING (user_id = public.current_user_id());

-- ===== TASKS =====
CREATE POLICY "tasks_select_own" ON public.tasks
    FOR SELECT USING (user_id = public.current_user_id());
CREATE POLICY "tasks_insert_own" ON public.tasks
    FOR INSERT WITH CHECK (user_id = public.current_user_id());
CREATE POLICY "tasks_update_own" ON public.tasks
    FOR UPDATE USING (user_id = public.current_user_id());
CREATE POLICY "tasks_delete_own" ON public.tasks
    FOR DELETE USING (user_id = public.current_user_id());
