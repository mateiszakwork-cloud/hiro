## Plan: Full Job Detail Page

### Database Changes
1. Create `contacts` table with columns: id, job_id, user_id, linkedin_url, name, headline, current_title, is_alumni, connection_note_draft, inmail_draft, outreach_status, created_at — with RLS policies
2. `notes` column already exists on `jobs` table — no migration needed

### Frontend Changes
1. **Add route** `/jobs/:jobId` in App.tsx (inside DashboardLayout)
2. **Create `src/pages/JobDetail.tsx`** — full detail page with:
   - Back button → /dashboard
   - Company name + job title heading
   - Clickable status pill
   - 4 tabs: Overview, Outreach, CV, Notes
3. **Update `JobTracker.tsx`** — add "Open full page" button in the side panel
4. **Tab implementations:**
   - Overview: two-column grid of all parsed fields
   - Outreach: contacts CRUD with LinkedIn URL input, contact cards, status dropdowns, message drafts with copy/edit
   - CV: placeholder Generate CV button + formatted output sections + Copy all / Download PDF
   - Notes: auto-saving textarea with "Saved" indicator
