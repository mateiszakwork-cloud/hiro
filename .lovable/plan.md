
## Goal

Rebuild Hiro's CV export so the DOCX and PDF match the uploaded "Máté Iszak" canonical layout: bold name, single contact line (phone | email | LinkedIn), uppercase section headings with a thin rule, role + company on a strong line, dates and locations right-aligned, tight one-page-friendly spacing, ATS-safe. Add a global-vs-tailored data split, an in-app preview, and section visibility / rename / reorder controls per job.

## 1. Data layer

**Schema (small additive migration only):**
- `profiles`: add `phone text`, `linkedin_url text`, `default_location text`. Used as the global header line across every CV.
- `cv_outputs`: add `section_config jsonb` with shape:
  ```
  { sections: [{ id, label, visible, order }], header_overrides?: {...} }
  ```
  Defaults to the canonical order: `summary, education, experience, entrepreneurial, footer` (footer = languages + interests + skills combined, matching the template).

No other schema changes. Existing `selected_bullets`, `selected_hard_skills`, etc. keep their current shape.

**`buildCvData.ts` returns a richer object:**
```
{
  header: { fullName, phone, email, linkedin, location },
  sections: [
    { id, label, visible, kind: 'summary'|'education'|'experience'|'entrepreneurial'|'footer', data }
  ]
}
```
- `header` is always sourced from `profiles` (global).
- Each section's `data` comes from the appropriate table; `experience` and `entrepreneurial` apply per-job `selected_bullets` / `selected_experiences` overrides.
- Section order, labels, visibility come from `cv_outputs.section_config` (with safe defaults).

## 2. Export generators (canonical layout)

Both `generateCvDocx.ts` and `generateCvPdf.ts` rewritten against the same spec, consuming the new `CvData`:

- **Header**: name centered, ~22pt bold; one centered metadata line `phone | email | LinkedIn` in muted gray, ~9.5pt.
- **Section heading**: ALL CAPS, bold, ~10pt, letter-spacing ~0.6, a 0.5pt rule underneath, generous `space-before`, tight `space-after`.
- **Experience entry**:
  - Line 1 (bold): `ROLE | Company`  …tab…  `MMM YYYY – MMM YYYY` (right)
  - Line 2 (regular, smaller, muted on right): short company descriptor (optional) … `CITY, CC` (right)
  - Bullets: hanging indent 0.4cm, "•" marker, ~10pt, 1.3 line height, ~2pt before/after.
- **Education entry**: same two-line pattern (`Degree at Institution` bold + dates right; field/GPA + location right; sub-bullets for awards/exchange/thesis).
- **Footer block (Languages, Interests, Software Skills)**: single section like the reference, each as one short paragraph with bold inline label.
- **Page rules**: `keepNext` on heading + first child, `keepLines` on each entry header pair, prevents orphaned headings and split role/first-bullet.
- **No borders, no tables, no colors** (drops the red rule — canonical reference is monochrome). Margins ~1.8cm top/bottom, 2cm left/right.
- Filename convention unchanged.

## 3. CV builder UI (in `JobDetail.tsx` CV tab)

Add three small UI pieces; keep current summary/bullet editors as-is.

1. **Global header banner** (read-only card at top of CV tab):
   `Header — Name · Phone · Email · LinkedIn · Location`  + "Edit global details" link → `/profile` (new section there for these 5 fields). Makes clear these are constant across every CV.
2. **Section controls panel** (collapsible "Layout" panel):
   - List of sections with: drag handle (dnd-kit, already lightweight) **or** up/down buttons (simpler, no dep) — going with **up/down + visibility toggle + inline rename** to avoid a new dependency.
   - Persists into `cv_outputs.section_config` on change.
3. **Preview pane**: a new `<CvPreview />` React component that renders the same `CvData` with HTML/Tailwind matching the export spec 1:1 (A4 aspect, scaled). Lives in a side panel or modal triggered by "Preview" button next to the existing Download dropdown.

## 4. Profile page additions

Add a "Contact & header" card in `src/pages/Profile.tsx` for `full_name`, `phone`, `email`, `linkedin_url`, `default_location`. Saves to `profiles`. Copy explains "These appear at the top of every CV you export."

## 5. Files touched

- **migration** — add `phone`, `linkedin_url`, `default_location` to `profiles`; add `section_config` to `cv_outputs`.
- `src/lib/buildCvData.ts` — extend output shape, source header from profile.
- `src/lib/cvSectionDefaults.ts` *(new)* — default `section_config`, kind/label helpers, merge helper.
- `src/lib/generateCvDocx.ts` — rewrite layout to canonical spec.
- `src/lib/generateCvPdf.ts` — rewrite layout to canonical spec.
- `src/components/cv/CvPreview.tsx` *(new)* — HTML preview.
- `src/components/cv/CvSectionControls.tsx` *(new)* — visibility / rename / reorder.
- `src/pages/JobDetail.tsx` — wire preview + controls into CV tab; pass profile.phone/linkedin into buildCvData call.
- `src/pages/Profile.tsx` — add Contact & header card.

## 6. Out of scope

- No drag-and-drop library (up/down arrows instead).
- No new section types beyond the canonical 5 (summary/education/experience/entrepreneurial/footer); awards stay rolled into education sub-bullets like the reference, with a fallback "Awards" section only if non-empty and education has none.
- No template picker.
- No changes to onboarding, CV parsing, tailor-cv edge function, or other tabs.

## Technical notes

- DOCX: use `docx` paragraph `keepNext`/`keepLines`, `tabStops` with `TabStopType.RIGHT` for date/location alignment, `LevelFormat.BULLET` for bullets (no unicode bullets in runs).
- PDF: `@react-pdf/renderer` — use `wrap={false}` on entry headers to keep role line + first bullet together; `View` with `break` prevention.
- Both generators share a small `cvLayout.ts` constants file (font sizes, spacings) so tweaks stay in sync.

Confirm and I'll implement.
