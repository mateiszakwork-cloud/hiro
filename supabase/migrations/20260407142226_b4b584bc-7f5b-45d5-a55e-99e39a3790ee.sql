ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS profile_picture_url text DEFAULT NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS current_company text DEFAULT NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS priority_score integer DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS shared_connections_count integer DEFAULT NULL;