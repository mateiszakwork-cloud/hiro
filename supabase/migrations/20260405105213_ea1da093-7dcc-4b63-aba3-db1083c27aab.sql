
-- Add new columns to education
ALTER TABLE public.education ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE public.education ADD COLUMN IF NOT EXISTS activities text;
ALTER TABLE public.education ADD COLUMN IF NOT EXISTS description text;

-- Add location to work_experiences
ALTER TABLE public.work_experiences ADD COLUMN IF NOT EXISTS location text;

-- Awards table
CREATE TABLE public.awards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  award_name text NOT NULL,
  issuing_organization text,
  year integer,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own awards" ON public.awards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own awards" ON public.awards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own awards" ON public.awards FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own awards" ON public.awards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Volunteering table
CREATE TABLE public.volunteering (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization text NOT NULL,
  role text,
  start_year integer,
  end_year integer,
  is_ongoing boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.volunteering ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own volunteering" ON public.volunteering FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own volunteering" ON public.volunteering FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own volunteering" ON public.volunteering FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own volunteering" ON public.volunteering FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Interests table (one row per user with array of interests)
CREATE TABLE public.interests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  interests text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own interests" ON public.interests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interests" ON public.interests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interests" ON public.interests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own interests" ON public.interests FOR DELETE TO authenticated USING (auth.uid() = user_id);
