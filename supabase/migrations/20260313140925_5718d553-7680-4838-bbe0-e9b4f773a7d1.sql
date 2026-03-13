
CREATE TABLE public.work_experiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  start_month INTEGER NOT NULL,
  start_year INTEGER NOT NULL,
  end_month INTEGER,
  end_year INTEGER,
  is_current BOOLEAN NOT NULL DEFAULT false,
  bullet_points TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.work_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own work experiences"
  ON public.work_experiences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own work experiences"
  ON public.work_experiences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own work experiences"
  ON public.work_experiences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own work experiences"
  ON public.work_experiences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
