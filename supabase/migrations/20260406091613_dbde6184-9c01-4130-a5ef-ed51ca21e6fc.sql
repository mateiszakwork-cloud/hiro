ALTER TABLE public.cv_outputs ALTER COLUMN selected_hard_skills DROP DEFAULT;
ALTER TABLE public.cv_outputs ALTER COLUMN selected_hard_skills TYPE jsonb USING to_jsonb(selected_hard_skills);
ALTER TABLE public.cv_outputs ALTER COLUMN selected_hard_skills SET DEFAULT '[]'::jsonb;