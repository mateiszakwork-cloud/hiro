-- Create outreach_contacts table
CREATE TABLE public.outreach_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  company TEXT,
  linkedin_url TEXT,
  category TEXT CHECK (category IN ('in_role', 'hiring_manager', 'recruiter')),
  connection_degree TEXT CHECK (connection_degree IN ('1st', '2nd', '3rd', 'unknown')) DEFAULT 'unknown',
  status TEXT NOT NULL CHECK (status IN ('not_contacted', 'messaged', 'replied', 'meeting_booked')) DEFAULT 'not_contacted',
  notes TEXT,
  drafted_message TEXT,
  date_added TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date_messaged TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_outreach_contacts_user_id ON public.outreach_contacts(user_id);
CREATE INDEX idx_outreach_contacts_job_id ON public.outreach_contacts(job_id);

-- Enable RLS
ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own outreach_contacts"
ON public.outreach_contacts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outreach_contacts"
ON public.outreach_contacts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outreach_contacts"
ON public.outreach_contacts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outreach_contacts"
ON public.outreach_contacts
FOR DELETE
USING (auth.uid() = user_id);