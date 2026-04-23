CREATE TABLE public.interview_prep_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  section1_extra JSONB NOT NULL DEFAULT '[]'::jsonb,
  role_specific JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id)
);

ALTER TABLE public.interview_prep_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interview_prep_answers"
ON public.interview_prep_answers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interview_prep_answers"
ON public.interview_prep_answers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interview_prep_answers"
ON public.interview_prep_answers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interview_prep_answers"
ON public.interview_prep_answers FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_interview_prep_answers_updated_at
BEFORE UPDATE ON public.interview_prep_answers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_interview_prep_answers_user_job ON public.interview_prep_answers(user_id, job_id);