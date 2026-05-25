-- 1. Add start_date to jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS start_date date;

-- 2. job_custom_columns: user-defined columns
CREATE TABLE IF NOT EXISTS public.job_custom_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_custom_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job_custom_columns" ON public.job_custom_columns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own job_custom_columns" ON public.job_custom_columns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own job_custom_columns" ON public.job_custom_columns
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own job_custom_columns" ON public.job_custom_columns
  FOR DELETE USING (auth.uid() = user_id);

-- 3. job_custom_column_values: per-job text values
CREATE TABLE IF NOT EXISTS public.job_custom_column_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL,
  column_id uuid NOT NULL REFERENCES public.job_custom_columns(id) ON DELETE CASCADE,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, column_id)
);
ALTER TABLE public.job_custom_column_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own job_custom_column_values" ON public.job_custom_column_values
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own job_custom_column_values" ON public.job_custom_column_values
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own job_custom_column_values" ON public.job_custom_column_values
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own job_custom_column_values" ON public.job_custom_column_values
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_jccv_job ON public.job_custom_column_values(job_id);
CREATE INDEX IF NOT EXISTS idx_jccv_user ON public.job_custom_column_values(user_id);
CREATE INDEX IF NOT EXISTS idx_jcc_user ON public.job_custom_columns(user_id);