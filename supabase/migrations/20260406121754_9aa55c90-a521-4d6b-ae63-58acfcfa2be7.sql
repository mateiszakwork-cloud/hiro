
CREATE TABLE public.interview_prep (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  company_overview TEXT,
  role_intelligence TEXT,
  your_pitch JSONB DEFAULT '[]'::jsonb,
  preparation_gaps JSONB DEFAULT '[]'::jsonb,
  interview_questions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, user_id)
);

ALTER TABLE public.interview_prep ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interview_prep"
  ON public.interview_prep FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interview_prep"
  ON public.interview_prep FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interview_prep"
  ON public.interview_prep FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interview_prep"
  ON public.interview_prep FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_interview_prep_updated_at
  BEFORE UPDATE ON public.interview_prep
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
