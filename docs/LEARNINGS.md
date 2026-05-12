# LEARNINGS

## 2026-05-12 — T-23 / BUG-02: 1970 dates from `new Date(null)`

**Issue:** SettingsView rendered `01.01.1970` for `inbox.created_at` when the value was null.

**Root cause:** `new Date(null)` returns the Unix epoch (not Invalid Date). The seconds-vs-milliseconds hypothesis was a red herring — null handling was the real gap.

**Fix:** Extracted the existing `toIsoDate` helper from `src/lib/api/emails.ts` to `src/lib/dates.ts` and used it in `SettingsView.tsx` before `new Date(...)`. Second occurrence of the same shape mismatch — extraction prevents the third.

**Follow-up (out of scope, do not forget):** Unify the date contract at the API boundary so every endpoint emits ISO 8601. Once enforced server-side, the defensive `toIsoDate` layer can be removed. Backend currently emits mixed shapes (null, Unix seconds, Unix ms, ISO strings) — see `docs/audits/AUDIT-BUG-02-1970-date-2026-05-12.md` section E.
