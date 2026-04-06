ALTER TABLE public.profiles
  ADD COLUMN base_cv_text text,
  ADD COLUMN base_cv_uploaded_at timestamp with time zone;