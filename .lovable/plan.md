# Cleanup Plan

Based on a full sweep of the codebase, here's everything safe to remove. Grouped by risk so you can opt in/out per group.

## 1. Dead edge functions (no frontend invokes them)

Delete these four function directories:
- `supabase/functions/search-linkedin-contacts/` — the old LinkedIn scraper; replaced by manual contact entry
- `supabase/functions/test-linkedin-connection/` — only read `profiles.linkedin_cookie`/`linkedin_jsessionid`
- `supabase/functions/draft-outreach-messages/` — never called (drafting feature will be rebuilt later)
- `supabase/functions/draft-tracker-message/` — never called

Verified: zero `functions.invoke('<name>')` calls anywhere in `src/`, and `supabase/config.toml` has no scheduled triggers.

## 2. Obsolete `contacts` table

The `contacts` table has **zero** live callers in `src/`. Its only writer was `search-linkedin-contacts` (deleted in group 1). `outreach_contacts` fully replaces it.

- Drop table `contacts` (migration)
- Drop columns `profiles.linkedin_cookie` and `profiles.linkedin_jsessionid` (only read by `test-linkedin-connection`, deleted in group 1)

Note: `src/integrations/supabase/types.ts` still has `contacts` row/insert/update types — that file is auto-generated and will refresh after the migration runs; no manual edit.

**Before running this:** confirm you don't need to keep/migrate any rows currently sitting in `contacts`.

## 3. Orphaned components in `src/components/`

Each of these has zero imports anywhere in the project:
- `CustomColumnCell.tsx`
- `ManualJobModal.tsx`
- `NavLink.tsx`
- `ProductTour.tsx`

The exploration also flagged `DashboardLayout.tsx` as orphaned — I'll re-verify against the recent Outreach nav changes before deleting it, and skip if it's actually wired up.

## 4. Unused imports

`src/pages/JobDetail.tsx` line 15: remove `AlertTriangle` and `Minus` from the lucide-react import (imported, never used).

## Technical details

Migration SQL for group 2:
```sql
DROP TABLE IF EXISTS public.contacts;
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS linkedin_cookie,
  DROP COLUMN IF EXISTS linkedin_jsessionid;
```

Edge function deletions go through `supabase--delete_edge_functions` (not `rm`), so the deploy registry stays in sync.

## Out of scope

- No changes to `OutreachTab.tsx`, `GlobalOutreachPage.tsx`, or `LinkedInSearchPanel` — all imports there are in use.
- No changes to `src/integrations/supabase/types.ts` (auto-generated).
- No changes to active edge functions: `tailor-cv`, `parse-job`, `calculate-match-score`, `generate-interview-prep`, `parse-cv`, `generate-bullet`.