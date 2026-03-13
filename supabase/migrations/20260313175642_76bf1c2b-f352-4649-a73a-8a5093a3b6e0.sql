CREATE TABLE public.languages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language_name TEXT NOT NULL,
  proficiency TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own languages" ON public.languages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own languages" ON public.languages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own languages" ON public.languages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own languages" ON public.languages FOR DELETE TO authenticated USING (auth.uid() = user_id);