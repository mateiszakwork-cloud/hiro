ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS default_location text;

ALTER TABLE public.cv_outputs
  ADD COLUMN IF NOT EXISTS section_config jsonb NOT NULL DEFAULT '{}'::jsonb;