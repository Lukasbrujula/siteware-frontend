# Frontend Audit — SiteFlow Dashboard

Audit date: 2026-04-15
Auditor: Claude Code (Opus 4.6)

---

## A. Data flow: backend → store

### A1. Full data path trace

1. **`useDataStream` hook** (`src/hooks/useDataStream.ts:51`): On mount (when `enabled=true`), calls `hydrateFromApi()` (line 66), then starts a 20-second polling interval that calls `pollForUpdates()`.

2. **`fetchAndMap()`** (`src/hooks/useDataStream.ts:21`): Fetches `GET /api/emails` with `Cache-Control: no-cache` header. Parses JSON. If `json.success === false`, returns null. Otherwise extracts `json.data ?? json` as payload. Passes payload to `mapBackendResponse()`.

3. **`mapBackendResponse()`** (`src/lib/api/emails.ts:128`): Calls `normaliseResponseData(payload)` to get a category-keyed object, then maps every email in each category array through `mapBackendEmail()`.

4. **`normaliseResponseData()`** (`src/lib/api/emails.ts:93`): Three strategies:
   - If input is an object with recognised category keys (spam, ad, urgent, other, escalation, unsubscribe), lowercases keys and returns as `Record<string, unknown[]>`.
   - If input is an object with a nested array (e.g. `{ emails: [...] }`), groups that flat array via `groupFlatArray()`.
   - If input is a top-level flat array, groups via `groupFlatArray()`.

5. **`groupFlatArray()`** (`src/lib/api/emails.ts:71`): Groups by `email.classification ?? email.category`, lowercased. Replaces `"unsub"` with `"unsubscribe"`.

6. **`mapBackendEmail()`** (`src/lib/api/emails.ts:14`): Transforms a raw backend row into the frontend shape. Field renames:
   - `email_id` ← `raw.email_id ?? raw.id`
   - `sender_email` ← `raw.from_address ?? raw.sender_email`
   - `sender_name` ← `raw.sender_name ?? senderEmail.split("@")[0]`
   - `sender_domain` ← extracted from sender_email
   - `body_plain` ← `raw.body_plain ?? raw.body ?? ""`
   - `category` ← `raw.category ?? raw.classification`
   - `date` ← `raw.date ?? raw.received_at ?? new Date().toISOString()`
   - `timestamp` ← `raw.timestamp ?? raw.received_at ?? new Date().toISOString()`
   - `draft_plain` ← `raw.draft_plain ?? raw.draft_text ?? raw.draft_content ?? ""`
   - `draft_html` ← `raw.draft_html ?? raw.draft_body ?? draft_plain`
   - `original_preview` ← `raw.original_preview ?? raw.preview ?? raw.snippet ?? ""`
   - `original_subject` ← `raw.original_subject ?? raw.subject ?? ""`
   - `confidence` ← `raw.confidence ?? raw.score ?? 0`
   - `reply_language` ← `raw.reply_language ?? raw.language ?? "de"`
   - `placeholders` ← `raw.placeholders ?? []`
   - `is_escalated` ← `raw.is_escalated ?? false`
   - `sentiment_score` ← `raw.sentiment_score ?? 0`
   - `review_reason` ← `raw.review_reason ?? ""`

7. **`hydrateFromServer()`** (`src/lib/store/email-store.ts:288`): Receives the category-keyed object. Calls `normalizeKeys()` (lowercases keys). Then **replaces** all store slices:
   - `spam` ← `data.spam`
   - `ads` ← `data.ad`
   - `urgent` ← `data.urgent`
   - `other` ← `data.other`
   - `escalations` ← `data.escalation`
   - `unsubscribes` ← `data.unsubscribe`

   Note: The first call uses `hydrateFromServer` (replaces all). Subsequent polling calls use `mergeFromServer` (only adds new emails by `email_id`).

### A2. `received_at` handling (the 1970 bug)

`mapBackendEmail` line 51: `date: raw.date ?? raw.received_at ?? new Date().toISOString()`.

The backend returns `received_at` as a **Unix timestamp integer (seconds since epoch)**. The mapper passes this raw integer through unchanged. There is no `* 1000` conversion.

When `formatDate` in `EmailTable.tsx:27` or `DraftList.tsx:13` later calls `new Date(dateStr)`, the value is first coerced to a string (the type annotation says `string`). `new Date("1713225600")` attempts to parse it as a date string — **this results in `Invalid Date` on most engines** because `"1713225600"` is not a valid ISO 8601 or RFC 2822 string.

However, if the value stays as a **number** (since the mapper spreads `...raw` and sets `date: raw.received_at`), then `new Date(1713225600)` treats it as **milliseconds since epoch**, producing **January 20, 1970** instead of **April 15, 2024**.

**YES, this is the 1970 bug.** Unix timestamps in seconds must be multiplied by 1000 for JavaScript's `Date` constructor. `new Date(1713225600)` → `1970-01-20T19:53:45.600Z`. The correct result would be `new Date(1713225600 * 1000)` → `2024-04-16T00:00:00.000Z`.

### A3. Confidence field

The backend does NOT have a `confidence` column. `mapBackendEmail` line 58: `confidence: raw.confidence ?? raw.score ?? 0`.

Since neither `confidence` nor `score` exists in the backend response, this always evaluates to `0`. **Yes, this is why confidence shows 0% everywhere.**

### A4. Body and draft fields from list endpoint

The backend `GET /api/emails` SELECT is: `id, from_address, subject, received_at, classification, sentiment, urgency, status, created_at`. **Neither `body` nor `draft_reply` are in this SELECT.**

- `OriginalEmail.tsx:59`: reads `email.body_plain ?? email.original_preview ?? ""`. Since `body` is not in the list response, `mapBackendEmail` sets `body_plain` to `raw.body_plain ?? raw.body ?? ""` — both are undefined from the list endpoint, so `body_plain` = `""`. Falls back to `original_preview`, which is also `""` (no `preview`/`snippet` in list endpoint either). **Result: empty string — no original email body displayed.**

- `DraftEditor.tsx`: uses `draftContent` which is initialized in `DraftReviewView.tsx:61` from `selectedEmail.draft_plain ?? ""`. Since `draft_reply` is not in the list endpoint, `mapBackendEmail` sets `draft_plain` to `""`. **Result: empty draft editor.**

**The frontend does NOT call `GET /api/emails/:id` for the selected email.** It only uses list data. Both body and draft will be empty.

---

## B. API endpoint matching

### B1. `approveDraft` — MISMATCH

- **Frontend** (`webhooks.ts:74`): `POST /api/email/send` with body `{ to, subject, body_html, body_plain, email_id }`.
- **Backend**: `POST /api/emails/:id/send` (note: plural `emails`, with `:id` in path).
- **Mismatches:**
  1. URL: `/api/email/send` vs `/api/emails/:id/send` — different path structure entirely. Frontend uses flat path; backend uses RESTful `:id` parameter.
  2. Body: Frontend sends `email_id` in body; backend expects `:id` in URL path.

### B2. `rejectDraft` — MISMATCH

- **Frontend** (`webhooks.ts:103-104`): `POST /api/webhooks/reject` with body `{ email_id, reason }`.
- **Backend**: No `/api/webhooks/reject` route exists. **This endpoint does not exist on the backend.**

### B3. `retriage` — MISMATCH

- **Frontend** (`webhooks.ts:107-108`): `POST /api/webhooks/retriage` with body `{ email_id, sender_email, subject, original_category }`.
- **Backend**: No `/api/webhooks/retriage` route exists. **This endpoint does not exist on the backend.**

### B4. `unsubscribe` — MISMATCH

- **Frontend** (`webhooks.ts:111-112`): `POST /api/webhooks/unsubscribe` with body `{ email_id, sender_email, list_unsubscribe_url, list_unsubscribe_mailto }`.
- **Backend**: No `/api/webhooks/unsubscribe` route exists. **This endpoint does not exist on the backend.**

### B5. `deleteEmailFromServer` — MISMATCH

- **Frontend** (`emails.ts:172`): `DELETE /api/email/:id` (singular `email`).
- **Backend**: No DELETE route documented. The backend has `POST /api/emails/:id/archive` (plural `emails`, archive not delete). **No DELETE route exists.**

### B6. `updateEmailStatus` — MISMATCH

- **Frontend** (`emails.ts:197`): `PATCH /api/email/:id` (singular `email`) with body `{ status }`.
- **Backend**: `PATCH /api/emails/:id/draft` (plural `emails`, different sub-path `/draft` not root). The backend PATCH is for updating draft text, not status. **Path mismatch and semantic mismatch.**

### B7. `fetchAndMap` (list endpoint) — MATCH

- **Frontend** (`useDataStream.ts:23`): `GET /api/emails`.
- **Backend**: `GET /api/emails`. **This matches.**

### B8. Auth flow — MATCH

- **Frontend** `auth-store.ts`:
  - `checkAuth`: `GET /api/auth/me` ✓
  - `logout`: `POST /api/auth/logout` ✓
- **Frontend** `LoginView.tsx`:
  - `handleRequestOtp`: `POST /api/auth/request-otp` ✓
  - `handleVerifyOtp`: `POST /api/auth/verify-otp` ✓
- **All four auth endpoints match the backend.**

### B-extra. Additional frontend endpoints with no known backend route

- `POST /api/email/audit` (`audit.ts:5`) — **No backend route documented.**
- `GET /api/emails/sent` (`SentView.tsx:69`) — **No backend route documented.**
- `GET /api/onboarding/tenants` (`SettingsView.tsx:39`) — **No backend route documented (may exist in a separate onboarding module).**
- `POST /api/onboarding/tenant-toggle` (`SettingsView.tsx:73`) — **No backend route documented.**
- `POST /api/onboarding/tenant-delete` (`SettingsView.tsx:107`) — **No backend route documented.**

### Summary of all endpoint mismatches

| #   | Frontend URL                     | Backend URL                    | Issue                                               |
| --- | -------------------------------- | ------------------------------ | --------------------------------------------------- |
| B1  | `POST /api/email/send`           | `POST /api/emails/:id/send`    | Path mismatch (singular vs plural, flat vs RESTful) |
| B2  | `POST /api/webhooks/reject`      | (none)                         | Route does not exist                                |
| B3  | `POST /api/webhooks/retriage`    | (none)                         | Route does not exist                                |
| B4  | `POST /api/webhooks/unsubscribe` | (none)                         | Route does not exist                                |
| B5  | `DELETE /api/email/:id`          | `POST /api/emails/:id/archive` | Wrong method and path                               |
| B6  | `PATCH /api/email/:id`           | `PATCH /api/emails/:id/draft`  | Wrong path (different sub-resource)                 |
| B7  | `GET /api/emails`                | `GET /api/emails`              | ✓ Match                                             |
| B8  | Auth endpoints                   | Auth endpoints                 | ✓ All match                                         |

---

## C. Date formatting

### C1. Every `formatDate` function

1. **`src/components/email/EmailTable.tsx:26-38`** — `function formatDate(dateStr: string): string`
2. **`src/components/email/DraftList.tsx:13-22`** — `function formatDate(dateString: string): string`
3. **`src/components/email/OriginalEmail.tsx:47-56`** — `function formatDate(dateString: string): string`
4. **`src/views/SentView.tsx:22-34`** — `function formatDate(dateStr: string): string`
5. **`src/lib/escalation-helpers.ts:10-18`** — `function formatTimestamp(timestamp: string): string`

### C2. Expected input types

All five functions declare their parameter as `string` and call `new Date(dateStr)`.

- They all expect a parseable date string (ISO 8601 format like `"2026-03-01T09:15:00Z"`).
- None handle numeric Unix timestamps.

### C3. What happens with `received_at = 1713225600`

`mapBackendEmail` sets `date: raw.date ?? raw.received_at`. Since the backend sends `received_at` as an integer, the `date` field could be the number `1713225600`.

If passed as a **number** to `new Date(1713225600)`: JavaScript treats it as **milliseconds**, producing **January 20, 1970 at 19:53:45 UTC**.

If somehow coerced to the **string** `"1713225600"` first: `new Date("1713225600")` returns **Invalid Date** on most engines, and `EmailTable.tsx` and `SentView.tsx` would display `"—"` (they check `isNaN`). `DraftList.tsx` and `OriginalEmail.tsx` do NOT check for Invalid Date and would display `"Invalid Date"`.

**Either way, dates are completely wrong.** The fix would be `new Date(raw.received_at * 1000)` in `mapBackendEmail`.

---

## D. Confidence display

### D1. Every place confidence is displayed

1. **`EmailTable.tsx:47`** — `ConfidenceBadge` component: `Math.round(confidence * 100)` → displays `"{percent}%"`.
2. **`DraftList.tsx:24-33`** — `ConfidenceBadge` component: `Math.round(confidence * 100)` → displays `"{percent}%"`.
3. **`DraftEditor.tsx:98`** — Inline in card header: `Math.round(email.confidence * 100)` → displays `"Konfidenz: {percent}%"`.

### D2. Expected value type

All three expect a **0-1 float** (they multiply by 100 to get a percentage).

### D3. Trace backward

- Component reads `email.confidence`
- Store holds whatever `hydrateFromServer` put in (raw cast, no validation)
- `hydrateFromServer` receives output of `mapBackendResponse`
- `mapBackendEmail` line 58: `confidence: raw.confidence ?? raw.score ?? 0`
- Backend `GET /api/emails` does not include `confidence` or `score` in its SELECT

### D4. Displayed value when backend never sends confidence

`confidence` = `0`. Display: `Math.round(0 * 100)` = **`0%`** everywhere.

Additionally, `low_confidence` is never sent by the backend either, so it defaults to `undefined` (falsy). The amber warning icon in `EmailTable.tsx:49` will never show.

---

## E. Sort order

### E1. Every sort location

1. **`EmailTable.tsx:143-148`**: `[...emails].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())` — sorts by date descending.
2. **`DraftList.tsx:40-45`**: `[...emails].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())` — same, date descending.
3. **`EscalationView.tsx:281-283`**: `[...escalations].sort(sortBySeverity)` — sorts by `legal_threat` first, then `sentiment_score` ascending (most negative first). Uses `escalation-helpers.ts:3-8`.

### E2. Does sort preserve relative order with broken dates?

If all `date` values are Unix timestamps in seconds (e.g., 1713225600, 1713225700, etc.), and they get passed to `new Date()` as numbers:

- `new Date(1713225600).getTime()` = `1713225600` (JS interprets as ms, returns that same value as the internal timestamp)
- Since Unix timestamps in seconds are monotonically increasing, the **relative order IS preserved** even though the absolute dates are wrong (they'll all appear as January 1970 dates, but sorted correctly relative to each other).
- However, if they're coerced to strings first and `new Date("1713225600")` returns `Invalid Date`, then `getTime()` returns `NaN`, and **all sort comparisons return `NaN`**, making the sort order **undefined/unstable**.

### E3. Backend SQL sort

Cannot determine from frontend code alone — the backend SQL query is in the separate `siteflow` repo. If the backend sorts by `received_at DESC`, and the frontend also sorts by date descending, they should agree. But if dates are broken (all NaN), the frontend sort is effectively random.

---

## F. Original email body

### F1. Field read in OriginalEmail.tsx

Line 59: `const rawContent = email.body_plain ?? email.original_preview ?? ""`

### F2. Backend field mapping for body_plain

`mapBackendEmail` line 49: `body_plain: raw.body_plain ?? raw.body ?? ""`

### F3. Is `body` in the list endpoint SELECT?

**No.** The backend `GET /api/emails` SELECT is: `id, from_address, subject, received_at, classification, sentiment, urgency, status, created_at`. The `body` column is NOT included.

### F4. Does the frontend call GET /api/emails/:id?

**No.** The frontend never calls the single-email endpoint. It only uses list data from `GET /api/emails`. There is no code path that fetches `GET /api/emails/:id` when an email is selected.

**Result: Original email body is always empty.** The `OriginalEmail` component will display an empty `<p>` tag since both `body_plain` and `original_preview` are `""`.

---

## G. Draft display and send flow

### G1. Draft content field in DraftEditor.tsx

`DraftEditor` receives `draftContent` as a prop. This is initialized in `DraftReviewView.tsx:61`: `const draft = selectedEmail.draft_plain ?? ""`

### G2. Backend field mapping for draft_plain

`mapBackendEmail` lines 24-28:

```
draft_plain = raw.draft_plain ?? raw.draft_text ?? raw.draft_content ?? ""
```

The backend column is called `draft_reply`, not any of these names. **None of these fallbacks match the backend field name.**

### G3. Does the frontend fetch the single email?

**No.** The frontend never calls `GET /api/emails/:id`. The list endpoint does not include `draft_reply`. The single-email endpoint does include it, but is never called.

**Result: Draft editor is always empty** (initialized to `""`, plus a `\n\n[SIGNATUR EINFÜGEN]` appended by `DraftReviewView.tsx:70`).

### G4. Approve flow walkthrough

1. User clicks "Genehmigen & Senden" in `DraftEditor.tsx:164`
2. `handleApprove` is called (`DraftEditor.tsx:69`), which calls `onApprove(email.email_id, draftContent)`
3. This invokes `handleApprove` in `DraftReviewView.tsx:89-142`
4. That calls `approveDraft()` from `webhooks.ts:71`
5. `approveDraft` sends `POST /api/email/send` with body `{ to, subject, body_html, body_plain, email_id }`
6. **Backend route is `POST /api/emails/:id/send`** — path does not match
7. The request will get a 404 from the backend
8. Even if it reached the backend, the backend expects the email ID in the URL path, not in the body
9. The backend also checks for `[BITTE ERGÄNZEN:]` placeholders and returns 422 — but this check never triggers because the request never reaches the route

---

## H. Placeholder handling

### H1. Detection and highlighting

`DraftEditor.tsx:64-67`: `const placeholdersExist = useMemo(() => hasPlaceholders(draftContent), [draftContent])`

`hasPlaceholders` is in `draft-helpers.ts:1-3`: uses regex `/\[BITTE ERGÄNZEN:[^\]]*\]/` to test the draft content string.

Highlighting: `DraftEditor.tsx:41-51` — `HighlightedPreview` component uses `buildHighlightedHtml(text)` from `draft-helpers.ts:18-26`, which wraps matches in `<mark class="rounded bg-yellow-200 px-0.5 text-yellow-900">`. This overlay is positioned absolutely over the textarea.

### H2. Approve button disabled when placeholders present?

**Yes.** `DraftEditor.tsx:165`: `disabled={placeholdersExist || submittingAction !== null}`. The button is disabled and shows a title tooltip "Platzhalter müssen ausgefüllt werden" (`DraftEditor.tsx:167-169`).

### H3. Backend 422 reachability

The frontend calls `POST /api/email/send` (B1 mismatch). The backend route is `POST /api/emails/:id/send`. Since the URL doesn't match, the request gets a 404 before the backend ever checks for placeholders. **The backend 422 validation is unreachable.**

However, the frontend-side placeholder check (H2) independently prevents sending drafts with unfilled placeholders, so the UX protection still works — the button is disabled. The backend check is defense-in-depth that currently cannot trigger.

---

## I. Login flow

### I1. Endpoints called

`LoginView.tsx`:

- Step 1 (`handleRequestOtp`, line 25): `POST /api/auth/request-otp` with body `{ email }`
- Step 2 (`handleVerifyOtp`, line 52): `POST /api/auth/verify-otp` with body `{ email, token: code }`

`auth-store.ts`:

- `checkAuth` (line 34): `GET /api/auth/me`
- `logout` (line 53): `POST /api/auth/logout`

### I2. Do these match backend routes?

**Yes, all four match:**

- `POST /api/auth/request-otp` ✓
- `POST /api/auth/verify-otp` ✓
- `GET /api/auth/me` ✓
- `POST /api/auth/logout` ✓

### I3. Session mechanism

**Cookie-based.** The frontend does not send any Authorization header or store tokens. `fetch` calls use default credentials mode (same-origin cookies are sent automatically). The backend `verify-otp` "sets session cookie" per the API docs, and `GET /api/auth/me` checks that cookie.

No explicit `credentials: "include"` is set on fetch calls, which means cookies are sent for same-origin requests only (default `same-origin` mode). This works correctly when the frontend is served from the same origin as the backend (embedded in SiteFlow or via Vite proxy during development).

---

## J. Build and deploy

### J1. Build output

`npm run build` runs `tsc -b && vite build` (per `package.json:8`). Vite outputs to `dist/` by default (no custom `build.outDir` in `vite.config.ts`).

### J2. How built frontend gets into backend's public/ directory

**Cannot determine from frontend code alone.** There is no automated copy script in `package.json`. The `dist.tar.gz` file in the git status suggests a manual process: build → tar → transfer to backend server → extract into `public/`. There is no CI/CD pipeline visible in this repo.

### J3. Vite proxy configuration

**Yes.** `vite.config.ts:13-18`:

```ts
server: {
  proxy: {
    "/api": {
      target: "http://187.124.174.50",
      changeOrigin: true,
    },
  },
}
```

All `/api/*` requests during development are proxied to `http://187.124.174.50`. This is the remote backend server IP.

---

## K. Dead code and n8n remnants

### K1. n8n-specific code in the frontend

The source code (`src/`) has **one reference** to n8n: a comment in `src/types/webhook.ts:16` — `"Retriage sends minimal data. n8n must look up the full email body by..."`.

No n8n webhook URLs, no n8n endpoint patterns, no SSE connections to n8n exist in the `src/` directory. The old n8n architecture has been replaced.

However, **CLAUDE.md** (project instructions) still extensively references n8n webhooks, SSE connections, and the Express data ingestion server. These docs are stale.

The `README.md`, `CLAUDE.md`, and `docs/Codebase_Audit.md` still reference:

- `VITE_N8N_WEBHOOK_BASE_URL`
- `VITE_DASHBOARD_API_PORT`
- `VITE_USE_MOCK_DATA`
- Express data ingestion server
- n8n webhook endpoints

Only `vitest.config.ts:17` still uses `VITE_N8N_WEBHOOK_BASE_URL` in test environment config.

### K2. src/server/ directory

**Does not exist.** `src/server/` is referenced in CLAUDE.md but the directory has been removed. The `server/index.ts`, `server/sse.ts`, and `server/validation.ts` files no longer exist.

### K3. mock-data.ts and seed-store.ts

Both files exist:

- `src/lib/mock-data.ts` — Contains mock data for all email categories.
- `src/lib/seed-store.ts` — Exports `seedStore()` function that populates the Zustand store with mock data.

**However, `seedStore()` is never imported or called anywhere in the application.** No file in `src/` imports from `seed-store.ts` (verified by grep). The function is dead code. Neither is it triggered by `VITE_USE_MOCK_DATA` — that env var is referenced only in docs and test config, not in application code.

### K4. References to n8n env vars in application code

**None.** No `.ts` or `.tsx` file in `src/` references `VITE_N8N_WEBHOOK_BASE_URL`, `VITE_USE_MOCK_DATA`, or `VITE_DASHBOARD_API_PORT`. These env vars are only in `README.md`, `CLAUDE.md`, `docs/Codebase_Audit.md`, and `vitest.config.ts`.

---

## Summary of Critical Bugs

| #   | Bug                                         | Severity | Root Cause                                                                                                                                                                   |
| --- | ------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Dates show as Jan 1970 or Invalid Date**  | HIGH     | `received_at` is Unix seconds, not multiplied by 1000 for JS Date constructor                                                                                                |
| 2   | **Confidence always shows 0%**              | MEDIUM   | Backend has no `confidence`/`score` column; mapper defaults to 0                                                                                                             |
| 3   | **Original email body always empty**        | HIGH     | List endpoint doesn't include `body`; frontend never fetches single-email endpoint                                                                                           |
| 4   | **Draft editor always empty**               | HIGH     | List endpoint doesn't include `draft_reply`; field name mismatch (`draft_reply` vs `draft_plain`/`draft_text`/`draft_content`); frontend never fetches single-email endpoint |
| 5   | **Approve/Send always 404s**                | CRITICAL | Frontend POSTs to `/api/email/send`; backend expects `/api/emails/:id/send`                                                                                                  |
| 6   | **Reject always 404s**                      | CRITICAL | Frontend POSTs to `/api/webhooks/reject`; no such backend route                                                                                                              |
| 7   | **Retriage always 404s**                    | HIGH     | Frontend POSTs to `/api/webhooks/retriage`; no such backend route                                                                                                            |
| 8   | **Unsubscribe always 404s**                 | HIGH     | Frontend POSTs to `/api/webhooks/unsubscribe`; no such backend route                                                                                                         |
| 9   | **Delete always 404s**                      | HIGH     | Frontend sends `DELETE /api/email/:id`; backend has `POST /api/emails/:id/archive`                                                                                           |
| 10  | **Status update always 404s**               | MEDIUM   | Frontend PATCHes `/api/email/:id`; backend has `PATCH /api/emails/:id/draft`                                                                                                 |
| 11  | **Dead code: seed-store and mock-data**     | LOW      | Files exist but are never imported                                                                                                                                           |
| 12  | **Stale documentation**                     | LOW      | CLAUDE.md references n8n architecture, src/server/, env vars that no longer apply                                                                                            |
| 13  | **`removeEmailById` has debug console.log** | LOW      | `email-store.ts:171-184` logs all email IDs on every removal — should be removed                                                                                             |
