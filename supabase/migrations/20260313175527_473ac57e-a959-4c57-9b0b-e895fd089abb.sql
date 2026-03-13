CREATE TABLE public.skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hard_skills TEXT[] NOT NULL DEFAULT '{}'::text[],
  soft_skills TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skills" ON public.skills FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skills" ON public.skills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skills" ON public.skills FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own skills" ON public.skills FOR DELETE TO authenticated USING (auth.uid() = user_id);