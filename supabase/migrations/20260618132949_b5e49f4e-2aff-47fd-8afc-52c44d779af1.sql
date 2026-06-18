DROP TABLE IF EXISTS public.outreach_contacts CASCADE;

CREATE TABLE public.outreach_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  name text,
  title text,
  company text,
  linkedin_url text,
  category text CHECK (category IN ('inrole', 'hiringmanager', 'recruiter')),
  connection_degree text CHECK (connection_degree IN ('1st', '2nd', '3rd', 'unknown')) DEFAULT 'unknown',
  status text CHECK (status IN ('notcontacted', 'reached_out', 'replied', 'meeting_booked', 'offer_referral', 'closed')) DEFAULT 'notcontacted',
  notes text,
  date_added timestamptz DEFAULT now(),
  date_messaged timestamptz,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outreach_contacts TO authenticated;
GRANT ALL ON public.outreach_contacts TO service_role;

ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own outreach contacts"
  ON public.outreach_contacts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_outreach_contacts_user_id ON public.outreach_contacts(user_id);
CREATE INDEX idx_outreach_contacts_job_id ON public.outreach_contacts(job_id);