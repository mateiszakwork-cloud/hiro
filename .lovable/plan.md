## Goal

Add a "Download CV" action to the per-job CV tab that produces a polished, professional file in either **Word (.docx)** or **PDF**, using everything the user has already selected/edited in Hiro (summary, bullets, skills, etc.).

## What already exists (no changes needed)

- Onboarding captures experiences, bullets, skills, languages, awards, education, and supports old-CV upload via `parse-cv` — keep as-is.
- The Job CV tab already lets the user generate, edit, and select what goes into the tailored CV (`cv_outputs` table).
- `src/lib/generateCvDocx.ts` already builds a clean Word document from the tailored CV data — but it is **not currently wired to any button** in `JobDetail.tsx`. That's the gap.

## What to add

### 1. Download button + format picker in the CV tab

In `src/pages/JobDetail.tsx` (CV tab section), add a **Download CV** dropdown button that appears once `cvOutput` exists:

- "Download as Word (.docx)"
- "Download as PDF"

Disabled while `cvLoading`. Shows a spinner during generation. On error, toast "Could not generate CV. Please try again." Never fails silently.

### 2. Word path — reuse what's there

- Import the existing `generateCvDocx` from `src/lib/generateCvDocx.ts`.
- Pass the current `cvOutput` + profile data (work experiences, education, languages, awards, interests, full name, email, location, company name).
- File naming already handled inside the helper: `{Name}_CV_{Company}_{Month}{Year}.docx`.

### 3. PDF path — new helper, matched styling

Create `src/lib/generateCvPdf.ts` that mirrors the structure and styling of `generateCvDocx.ts` so both downloads look like the same document in two formats:

- Use **`@react-pdf/renderer`** (client-side, no server work, plays well with the existing Vite setup). Install via `bun add @react-pdf/renderer`.
- Same sections in the same order: Header (name + contact) → Summary → Professional Experience → Volunteering → Education → Awards → Languages / Skills / Interests footer block.
- Same brand accents: Hiro red `#950606` section underline, Calibri-equivalent body, A4 page with ~2cm margins, hanging-indent bullets.
- File naming: `{Name}_CV_{Company}_{Month}{Year}.pdf`.

### 4. Small shared util

Extract the data-assembly (the "build CvData from cvOutput + profile tables" block) into a shared function in `src/lib/buildCvData.ts` so both `generateCvDocx` and `generateCvPdf` consume the same input — avoids drift between formats.

## Out of scope

- No changes to onboarding, CV parsing, the editor UI inside the CV tab, the `tailor-cv` edge function, or any other tab.
- No multiple template styles (single professional template, matching today's docx look).
- No server-side PDF generation — fully client-side keeps it free and instant.

## Technical notes

- `@react-pdf/renderer` adds ~300 KB gzipped; acceptable since the CV tab is already heavy. Can be lazy-loaded with `import()` on first download click so it doesn't hit initial bundle.
- The existing `generateCvDocx` uses `file-saver` + `docx` (already in `bun.lock`), so the .docx path needs zero new deps.
- The data shape `CvData` in `generateCvDocx.ts` already covers everything; reuse the same TypeScript type for `generateCvPdf`.

## Files touched

- `src/lib/buildCvData.ts` *(new)* — assembles CvData from `cvOutput` + profile tables
- `src/lib/generateCvPdf.ts` *(new)* — React-PDF document, mirrors docx layout
- `src/pages/JobDetail.tsx` — adds Download dropdown in CV tab, wires both handlers
- `package.json` / `bun.lock` — adds `@react-pdf/renderer`
