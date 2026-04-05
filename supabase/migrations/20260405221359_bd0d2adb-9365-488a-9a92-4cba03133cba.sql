
CREATE TABLE public.cv_outputs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_headline text,
  selected_experiences jsonb DEFAULT '[]'::jsonb,
  selected_hard_skills text[] DEFAULT '{}'::text[],
  selected_soft_skills text[] DEFAULT '{}'::text[],
  selected_education jsonb DEFAULT '[]'::jsonb,
  selected_languages jsonb DEFAULT '[]'::jsonb,
  selected_awards jsonb DEFAULT '[]'::jsonb,
  selected_volunteering jsonb DEFAULT '[]'::jsonb,
  tailoring_notes text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(job_id, user_id)
);

ALTER TABLE public.cv_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cv_outputs" ON public.cv_outputs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cv_outputs" ON public.cv_outputs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cv_outputs" ON public.cv_outputs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cv_outputs" ON public.cv_outputs FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_cv_outputs_updated_at
BEFORE UPDATE ON public.cv_outputs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
