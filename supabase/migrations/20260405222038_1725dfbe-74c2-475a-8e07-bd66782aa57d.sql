
CREATE TABLE public.cv_output_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cv_output_id uuid NOT NULL REFERENCES public.cv_outputs(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cv_output_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cv history" ON public.cv_output_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cv history" ON public.cv_output_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own cv history" ON public.cv_output_history FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_cv_output_history_job_user ON public.cv_output_history(job_id, user_id);
