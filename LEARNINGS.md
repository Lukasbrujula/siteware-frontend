# Project Learnings

<!-- Document issues encountered and their solutions -->

## Template

```markdown
## [Date] - [Issue Title]

**Issue:** What happened
**Root cause:** Why it happened
**Fix:** What solved it
**Prevention:** How to avoid next time
```

---

<!-- Add learnings below -->

## 2026-03-02 - shadcn/ui writes to literal @/ directory with Vite

**Issue:** `npx shadcn@latest add` created files in a literal `@/` directory at project root instead of `src/`
**Root cause:** shadcn/ui resolves the `@` alias literally when the project isn't Next.js. The `components.json` alias config points to `@/components` but shadcn creates a physical `@/` folder.
**Fix:** After running `npx shadcn add`, copy files from `@/components/ui/` to `src/components/ui/` and delete the literal `@/` directory.
**Prevention:** After any `npx shadcn add` command, check if files landed in `@/` vs `src/` and move if needed.

## 2026-03-02 - shadcn/ui sonner component imports next-themes

**Issue:** The shadcn sonner.tsx component imports `useTheme` from `next-themes` and self-references its own module.
**Root cause:** shadcn/ui assumes Next.js. The sonner component template includes Next.js-specific theme integration.
**Fix:** Rewrote sonner.tsx to import directly from `sonner` package, removed `next-themes` dependency, removed self-referencing import.
**Prevention:** After installing shadcn components, audit for `next-themes` or other Next.js imports. Remove/rewrite as needed for Vite SPA.

## 2026-03-07 - IMAP Sent folder detection for Gmail

**Issue:** Tone profile scan was missing `[Gmail]/Sent Mail` in the IMAP folder candidates, meaning Gmail accounts that don't advertise the `\Sent` special-use flag would fail to find the Sent folder.
**Root cause:** `SENT_FOLDER_CANDIDATES` only had generic names (Sent, Sent Items, Gesendet) but not Gmail-specific `[Gmail]/Sent Mail` or `[Gmail]/Gesendet`.
**Fix:** Added `[Gmail]/Sent Mail` and `[Gmail]/Gesendet` to the candidate list. Detection strategy: (1) check `\Sent` special-use flag first (works for most providers including Gmail), (2) fall back to name matching with Gmail candidates prioritized. Added console logging of detected folder name for Vercel function logs.
**Prevention:** When working with IMAP folders, always include provider-specific folder names: `[Gmail]/Sent Mail` for Gmail, `Sent Items` for Outlook, `Gesendet` for German-locale servers.

## 2026-03-07 - Frontend jargon field name for onboarding

**Issue:** The frontend sends industry jargon as `toneProfile.jargon` (an array of strings) in the save-tenant request body. The save handler was ignoring this field entirely — it was never written to the tone profile or included in the injection prompt.
**Root cause:** The `handleSaveTenant` function only mapped known fields (greeting, closing, formality, etc.) but had no mapping for `jargon`.
**Fix:** Added `industry_jargon` field to `ToneProfile` type. In `handleSaveTenant`, read `toneData.jargon` via `parseStringArray()` (handles both array and comma-separated string input). In `buildInjection()`, added line: `- Use these industry terms naturally: term1, term2`. Schema validation accepts `industry_jargon` as optional so old profiles without it still load fine.
**Prevention:** When adding new fields to onboarding steps, trace the full path: frontend form → request body → save handler → type definition → injection builder.

## 2026-03-07 - Tone injection endpoint accepts classification query param

**Issue:** n8n needs to pass email classification to the injection endpoint so URGENT emails get a formal tone override.
**Root cause:** The injection endpoint had no awareness of email context — it always returned the same tone profile regardless of urgency.
**Fix:** `GET /api/tone-profile/{tenantId}/injection?classification=URGENT` prepends a formal override block ("Use Sie, full sentences, professional closing"). Any other value or missing param returns the baseline profile unchanged. The param is case-insensitive (lowercased then compared).
**Prevention:** When n8n calls this endpoint, pass `?classification=URGENT` or `?classification=OTHER`. Missing/unrecognized values safely default to no override.
