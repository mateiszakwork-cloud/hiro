ALTER TABLE public.jobs ADD COLUMN languages_nice_to_have text[] DEFAULT '{}'::text[];
ALTER TABLE public.jobs ADD COLUMN skills_nice_to_have text[] DEFAULT '{}'::text[];