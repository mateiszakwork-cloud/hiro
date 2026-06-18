ALTER POLICY "Users can update own profile" ON public.profiles USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;