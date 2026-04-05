ALTER TABLE public.jobs ADD COLUMN priority text NOT NULL DEFAULT 'Medium';
ALTER TABLE public.jobs ADD COLUMN applied_date date;