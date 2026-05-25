ALTER TABLE public.education
  ADD COLUMN IF NOT EXISTS level_of_study text,
  ADD COLUMN IF NOT EXISTS start_month integer,
  ADD COLUMN IF NOT EXISTS end_month integer,
  ALTER COLUMN field_of_study DROP NOT NULL;