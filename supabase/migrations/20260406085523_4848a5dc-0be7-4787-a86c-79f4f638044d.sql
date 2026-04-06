ALTER TABLE public.cv_outputs
  ADD COLUMN IF NOT EXISTS tailored_summary text,
  ADD COLUMN IF NOT EXISTS selected_bullets jsonb DEFAULT '{}'::jsonb;