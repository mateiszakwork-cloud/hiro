
-- Profiles: table already exists, just ensure policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Ensure trigger exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Work Experiences policies
DROP POLICY IF EXISTS "Users can view own work experiences" ON public.work_experiences;
DROP POLICY IF EXISTS "Users can insert own work experiences" ON public.work_experiences;
DROP POLICY IF EXISTS "Users can update own work experiences" ON public.work_experiences;
DROP POLICY IF EXISTS "Users can delete own work experiences" ON public.work_experiences;
CREATE POLICY "Users can view own work experiences" ON public.work_experiences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own work experiences" ON public.work_experiences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own work experiences" ON public.work_experiences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own work experiences" ON public.work_experiences FOR DELETE USING (auth.uid() = user_id);

-- Education policies
DROP POLICY IF EXISTS "Users can view own education" ON public.education;
DROP POLICY IF EXISTS "Users can insert own education" ON public.education;
DROP POLICY IF EXISTS "Users can update own education" ON public.education;
DROP POLICY IF EXISTS "Users can delete own education" ON public.education;
CREATE POLICY "Users can view own education" ON public.education FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own education" ON public.education FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own education" ON public.education FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own education" ON public.education FOR DELETE USING (auth.uid() = user_id);

-- Skills policies
DROP POLICY IF EXISTS "Users can view own skills" ON public.skills;
DROP POLICY IF EXISTS "Users can insert own skills" ON public.skills;
DROP POLICY IF EXISTS "Users can update own skills" ON public.skills;
DROP POLICY IF EXISTS "Users can delete own skills" ON public.skills;
CREATE POLICY "Users can view own skills" ON public.skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skills" ON public.skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skills" ON public.skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own skills" ON public.skills FOR DELETE USING (auth.uid() = user_id);

-- Languages policies
DROP POLICY IF EXISTS "Users can view own languages" ON public.languages;
DROP POLICY IF EXISTS "Users can insert own languages" ON public.languages;
DROP POLICY IF EXISTS "Users can update own languages" ON public.languages;
DROP POLICY IF EXISTS "Users can delete own languages" ON public.languages;
CREATE POLICY "Users can view own languages" ON public.languages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own languages" ON public.languages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own languages" ON public.languages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own languages" ON public.languages FOR DELETE USING (auth.uid() = user_id);

-- Awards policies
DROP POLICY IF EXISTS "Users can view own awards" ON public.awards;
DROP POLICY IF EXISTS "Users can insert own awards" ON public.awards;
DROP POLICY IF EXISTS "Users can update own awards" ON public.awards;
DROP POLICY IF EXISTS "Users can delete own awards" ON public.awards;
CREATE POLICY "Users can view own awards" ON public.awards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own awards" ON public.awards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own awards" ON public.awards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own awards" ON public.awards FOR DELETE USING (auth.uid() = user_id);

-- Volunteering policies
DROP POLICY IF EXISTS "Users can view own volunteering" ON public.volunteering;
DROP POLICY IF EXISTS "Users can insert own volunteering" ON public.volunteering;
DROP POLICY IF EXISTS "Users can update own volunteering" ON public.volunteering;
DROP POLICY IF EXISTS "Users can delete own volunteering" ON public.volunteering;
CREATE POLICY "Users can view own volunteering" ON public.volunteering FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own volunteering" ON public.volunteering FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own volunteering" ON public.volunteering FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own volunteering" ON public.volunteering FOR DELETE USING (auth.uid() = user_id);

-- Interests policies
DROP POLICY IF EXISTS "Users can view own interests" ON public.interests;
DROP POLICY IF EXISTS "Users can insert own interests" ON public.interests;
DROP POLICY IF EXISTS "Users can update own interests" ON public.interests;
DROP POLICY IF EXISTS "Users can delete own interests" ON public.interests;
CREATE POLICY "Users can view own interests" ON public.interests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own interests" ON public.interests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own interests" ON public.interests FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own interests" ON public.interests FOR DELETE USING (auth.uid() = user_id);

-- Jobs policies
DROP POLICY IF EXISTS "Users can view own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can delete own jobs" ON public.jobs;
CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE USING (auth.uid() = user_id);

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('cv-uploads', 'cv-uploads', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Users can upload own CVs" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own CVs" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own CVs" ON storage.objects;
CREATE POLICY "Users can upload own CVs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can read own CVs" ON storage.objects FOR SELECT USING (bucket_id = 'cv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own CVs" ON storage.objects FOR DELETE USING (bucket_id = 'cv-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
