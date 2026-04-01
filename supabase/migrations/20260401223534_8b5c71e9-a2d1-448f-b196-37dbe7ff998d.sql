
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT,
  company_name TEXT,
  job_title TEXT,
  function TEXT,
  location TEXT,
  work_mode TEXT,
  duration TEXT,
  hard_skills TEXT[] DEFAULT '{}'::text[],
  soft_skills TEXT[] DEFAULT '{}'::text[],
  languages_required TEXT[] DEFAULT '{}'::text[],
  application_deadline DATE,
  status TEXT NOT NULL DEFAULT 'Saved',
  match_score INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);
