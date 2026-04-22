# Reclassify Frontend Audit

**Scope:** read-only audit of `Lukasbrujula/siteware-frontend` (Vite React SPA) to prepare for wiring a reclassify action to the upcoming backend `POST /api/emails/:id/reclassify`. No code edits.

Files inspected (HEAD at time of audit):

- `src/lib/api/emails.ts` — server fetch/normalise + archive helper
- `src/lib/api/webhooks.ts` — all action helpers (approve, reject, retriage, unsubscribe)
- `src/lib/store/email-store.ts` — Zustand store, slice routing, hydrate/merge
- `src/components/email/EmailTable.tsx` — shared table for Spam/Ad views
- `src/views/SpamView.tsx`, `src/views/AdView.tsx` — action call sites
- `src/views/DraftReviewView.tsx`, `src/views/UrgentView.tsx` — draft-review shell
- `src/hooks/useDataStream.ts` — 20s poll + merge
- `vite.config.ts`, `package.json` — build config
- `docs/FRONTEND_AUDIT.md` — exists (not used here, but present)

Cross-repo: backend audit at `/Users/lukasmargenfeld/clients/SW V2/siteflow/docs/RECLASSIFY_BACKEND_AUDIT.md` read for the four unknowns (§2 below).

---

## 1. Existing action pattern

### 1a. Action helpers — signatures and URLs

All action helpers live in `src/lib/api/webhooks.ts` and all hit `/api/emails/:id/:action` via the internal helper `emailUrl(id, action)` at `src/lib/api/webhooks.ts:51-53`:

```ts
function emailUrl(emailId: string, action: string): string {
  return `/api/emails/${encodeURIComponent(emailId)}/${action}`;
}
```

| Helper                  | Signature                                                       | HTTP                             | URL                                             | Body                                                              |
| ----------------------- | --------------------------------------------------------------- | -------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| `approveDraft`          | `(payload: ApproveDraftPayload) => Promise<ApproveDraftResult>` | `PATCH /draft` then `POST /send` | `/api/emails/:id/draft`, `/api/emails/:id/send` | `{ draft_reply }`, then empty                                     | `src/lib/api/webhooks.ts:72-119`  |
| `rejectDraft`           | `(payload: RejectDraftPayload) => Promise<void>`                | `POST`                           | `/api/emails/:id/reject`                        | `{ reason }`                                                      | `src/lib/api/webhooks.ts:121-139` |
| `retriage`              | `(payload: RetriagePayload) => Promise<void>`                   | `POST`                           | `/api/emails/:id/retriage`                      | `{ sender_email, subject, original_category }`                    | `src/lib/api/webhooks.ts:141-163` |
| `unsubscribe`           | `(payload: UnsubscribePayload) => Promise<void>`                | `POST`                           | `/api/emails/:id/unsubscribe`                   | `{ sender_email, list_unsubscribe_url, list_unsubscribe_mailto }` | `src/lib/api/webhooks.ts:165-195` |
| `deleteEmailFromServer` | `(emailId: string) => Promise<void>`                            | `POST`                           | `/api/emails/:id/archive`                       | empty                                                             | `src/lib/api/emails.ts:230-246`   |

Error shape: each helper throws `WebhookError(message, status, endpoint)` (`src/lib/api/webhooks.ts:37-47`) or `ServerApiError` for the archive helper (`src/lib/api/emails.ts:218-228`). Timeouts are per-action via `AbortSignal.timeout(n)` — 10s for PATCH draft, 30s for everything else. A reclassify helper should follow this pattern exactly — reuse `emailUrl(id, "reclassify")`, throw `WebhookError`, set a 30s (or 60s if the backend does the inline reply-agent call per backend audit §9c) timeout.

Note on the existing retriage body: per the backend audit §10, the backend **ignores** the body (`sender_email`, `subject`, `original_category` are dead weight). The body is a historical contract mismatch. The new reclassify helper should send only what the backend actually uses — `{ new_classification }`.

### 1b. Zustand store update pattern on action success

The pattern is **optimistic local mutation, then refresh**. Walking `SpamView.handleMoveToInbox` at `src/views/SpamView.tsx:121-197`:

1. Fire action: `await retriage({...})` (line 129).
2. On success, call `removeEmail("spam", id)` (line 165) — slice-scoped filter, removes the row from `state.spam` via `src/lib/store/email-store.ts:135-167`.
3. Then `await refreshStoreFromServer()` (line 169), which calls `GET /api/emails` and pipes the result through `hydrateFromServer` (`src/lib/api/emails.ts:202-216` → `src/lib/store/email-store.ts:288-300`). `hydrateFromServer` **replaces** every slice wholesale; it does not merge.

So the pattern is:

- **Optimistic remove** from the source slice only (`removeEmail(slice, id)`).
- **Hydrate** the whole store from the server to pick up whichever new slice the email moved into.
- The 20s background poll (`src/hooks/useDataStream.ts:73-91`) uses `mergeFromServer` (add-only, won't remove rows from other slices), so the post-action `refreshStoreFromServer` is load-bearing — without it, a reclassified row would sit in its new slice only after the next full hydrate.

`AdView.handleMoveToInbox` at `src/views/AdView.tsx:148-224` is the same pattern. `AdView.handleUnsubscribe` at `src/views/AdView.tsx:226-272` is slightly simpler — single-row, removes locally, no refresh (unsubscribe is terminal for that row).

Relevant store action methods:

- `removeEmail(slice, id)` — `src/lib/store/email-store.ts:135-167`, slice-scoped.
- `removeEmailById(id)` — `src/lib/store/email-store.ts:169-194`, removes across **all** slices (includes a `console.log` call at line 171 — dev-noise, not an audit finding but worth flagging).
- `updateEmail(slice, id, updates)` — `src/lib/store/email-store.ts:196-248`, partial field update in place.
- `hydrateFromServer(data)` — `src/lib/store/email-store.ts:288-300`, full replace.
- `mergeFromServer(data)` — `src/lib/store/email-store.ts:302-330`, add-only union, does not remove stale rows.

No action currently performs a "move between slices" as an atomic store operation. The move is always `removeEmail(oldSlice, id)` → server → `hydrateFromServer()` restocks the new slice.

### 1c. "Aktionen" column in the UI

`EmailTable` is the shared component for Spam and Ad views. The Aktionen column is **conditional**: it only renders when the caller passes a `renderRowActions` prop.

- Column definition: `src/components/email/EmailTable.tsx:141` (`columnCount = renderRowActions ? 7 : 6`) and `src/components/email/EmailTable.tsx:179-181` (the `<TableHead>Aktionen</TableHead>` cell).
- Per-row render: `src/components/email/EmailTable.tsx:283-287` — calls `renderRowActions(email)` inside a `<TableCell>` with `onClick={handleActionsCellClick}` (stops propagation so clicking an action button doesn't toggle row expansion).

**SpamView** (`src/views/SpamView.tsx:249-257`) calls `EmailTable` **without** `renderRowActions` — so the Spam view currently has no Aktionen column at all. The "In Posteingang" + "Ausgewählte löschen" buttons are in the `CardHeader` toolbar (`src/views/SpamView.tsx:213-245`) and act on the bulk selection (`selectedIds`), not per-row.

**AdView** (`src/views/AdView.tsx:274-299`) **does** pass `renderRowActions`. The column today renders per-row:

- A `UnsubscribeIndicator` (available/not available).
- An "Abmelden" button (only if `email.unsubscribe_available === true`, `AdView.tsx:280-294`).

So the Aktionen column exists in Werbung but holds one action (Abmelden). To wire reclassify, the path is: add a reclassify button/dropdown inside `renderRowActions` in `AdView`, add the same prop in `SpamView` (currently absent — bulk-only), and decide whether Urgent/Other draft views need an equivalent row-level affordance (they don't use `EmailTable` at all — they use `DraftList` / `DraftReviewView`, a different layout per `src/views/DraftReviewView.tsx`).

There is no existing dropdown/menu primitive in `src/components/ui/` beyond `dialog.tsx` — so a "reclassify" affordance is either (a) a row of four small variant buttons, or (b) a new shadcn `DropdownMenu` primitive to install. Option (a) is zero-dependency; option (b) matches the backend's four-way enum more cleanly.

### 1d. Confirmation UX

**No generic confirmation-modal pattern exists.** Destructive-in-name actions fire immediately today:

- "Ausgewählte löschen" in Spam/Ad — fires `deleteEmailFromServer` immediately on click (`src/views/SpamView.tsx:226`, `src/views/AdView.tsx:329`), no confirm step. Only feedback is a `toast.success`/`toast.error`.
- "In Posteingang" (retriage) — same pattern, no confirm.
- "Abmelden" — same, no confirm.

The one place `Dialog` **is** used is `src/views/EscalationView.tsx:233-…` — a reject-dialog (`rejectDialogOpen` state at line 53) that collects a reason before submitting. That is the only in-repo precedent for a confirmation modal, and it's for collecting a free-text reason, not for a yes/no confirm. The shadcn `Dialog` primitive exists at `src/components/ui/dialog.tsx`, so a reclassify confirmation modal is low-effort if one is needed.

Given reclassify is a corrective action (not destructive — per backend audit §7 and §11 Case A, it preserves the underlying email and is reversible by another reclassify), a confirm step is probably not necessary for URGENT/OTHER → URGENT/OTHER moves. For URGENT/OTHER → SPAM/AD (which nulls `draft_reply` per backend audit §9b), a lightweight "Entwurf wird verworfen" warning in a Dialog is defensible.

---

## 2. Reclassify-specific design

### 2a. The four backend unknowns — answered

Cross-referenced with the backend audit's Proposed Approach §§9–12 (these are the backend-side unknowns the FE has to support):

1. **Where does the reclassify button attach in the React source?** — Row-level in `AdView` and `SpamView` via `renderRowActions` on `EmailTable`. For draft-review views (`UrgentView`/`OtherView` → `DraftReviewView`), the button goes in the `DraftEditor` action bar next to "Senden"/"Ablehnen". See §3 below for the file-by-file list.

2. **Does `hydrateFromServer` cleanly move a row between buckets?** — Yes, because it's a **full replace** (`src/lib/store/email-store.ts:288-300` sets every slice to `data.spam ?? []`, `data.ad ?? []`, etc.). A reclassified email appears exactly once: in the new slice, not in the old. No double-render. Confirmed safe for reclassify. The 20s `mergeFromServer` poll is **not** safe on its own (it's add-only per `src/lib/store/email-store.ts:302-330`) — but the existing action pattern always calls `refreshStoreFromServer()` after success, which is the full-hydrate path. Reclassify must follow the same pattern: optimistic `removeEmail(oldSlice, id)` + `await refreshStoreFromServer()` on success.

3. **Is ~5-10s "reclassifying…" UX acceptable?** — Yes. The existing `approveDraft` flow already holds a 30s timeout (`src/lib/api/webhooks.ts:100`) and shows a spinner via `submittingAction` state in `DraftReviewView` (`src/views/DraftReviewView.tsx:51-53`). The `Loader2` spinner pattern is used in every view (`SpamView.tsx:228`, `AdView.tsx:287`). A 5-10s latency for SPAM/AD → URGENT/OTHER reclassify is within normal range — no need for the backend's option 9c-iii async status. The UI already tolerates it.

4. **Should `original_category` be repurposed for reclassify?** — No. The retriage body is dead weight per backend audit §10; the new helper should send `{ new_classification }` only and use a new URL suffix `/reclassify`. Keep the two endpoints distinct.

### 2b. Target-classification UX

Given the row is already in a known category (`email.category` at `SpamView.tsx:133`, `AdView.tsx:160`), the reclassify picker **must exclude the current classification** — no-op reclassifies are allowed by the backend per backend audit §11 Case C (early-return 200) but should be hidden in UI to avoid confusion.

Three UX options, ordered by fit:

1. **Inline three-button group in the Aktionen cell** — e.g., in `AdView`, next to "Abmelden": three small `variant="outline" size="xs"` buttons labelled "Dringend" / "Sonstige" / "Spam". Matches the existing `size="xs"` Abmelden button. Space-tight but zero new primitives. Clearest affordance, no click required to see options.

2. **Dropdown menu** — install shadcn `DropdownMenu`, single "Neu klassifizieren" trigger, menu shows the three non-current classes. Cleaner at the row level but requires a new primitive.

3. **Modal picker** — overkill given the decision is 1-of-3; reserve for destructive cases.

Recommendation: **Option 1** for row-level in Spam/Ad (fits the existing `size="xs"` button rhythm), **Option 1** in the DraftEditor footer for Urgent/Other (fits next to Senden/Ablehnen). Exclude the current class programmatically.

German labels per `CLAUDE.md` "Six Category Views": Spam → **Spam**, AD → **Werbung**, URGENT → **Dringend**, OTHER → **Sonstige**.

### 2c. Moving between tabs

Covered in 2a point 2: **yes**, the current store architecture handles it cleanly via the `removeEmail(oldSlice, id)` + `refreshStoreFromServer()` (full-hydrate) pattern already proven by retriage at `src/views/SpamView.tsx:164-170`. There is no "move" primitive in the store — and there shouldn't need to be one; the optimistic-remove + server-hydrate pattern is consistent and already tested.

One caveat: a reclassified email flows through `mapBackendEmail` at `src/lib/api/emails.ts:33-124` on hydrate. That function maps `raw.classification` → `raw.category` at line 100 (`category: raw.category ?? raw.classification`). So the store will route the reclassified row into the correct slice as long as the backend emits the new `classification` value in the `GET /api/emails` response. No FE normalization changes needed.

### 2d. Draft visibility after SPAM/AD → URGENT/OTHER reclassify

Per backend audit §9c recommendation (ii): the backend calls the Reply Composer **inline** and returns once `status='draft'` and `draft_reply` is populated. The response latency is 5-10s.

Frontend flow end-to-end:

1. User clicks "Dringend" in the Werbung Aktionen cell.
2. FE fires `reclassify({ email_id, new_classification: "URGENT" })` — shows a `Loader2` spinner in place of the button, disables other actions on the row (follow the `unsubscribingId` pattern at `src/views/AdView.tsx:56, 282-294`).
3. Backend runs the reply agent, writes `status='draft'`, `draft_reply=...`, returns 200.
4. FE: `removeEmail("ads", id)` → `await refreshStoreFromServer()` → the row now hydrates into `state.urgent` with a populated `draft_plain` (mapped from `draft_reply` at `src/lib/api/emails.ts:44`).
5. Toast: "E-Mail in Dringend verschoben, Entwurf bereit".

**Interim state (between click and response):** only the per-row spinner on the clicked button. The row stays in its current slice (not removed optimistically) until the server confirms. This is different from the retriage pattern (which optimistically removes) because retriage is fast; reclassify with inline draft generation is slow, and removing the row optimistically would make it disappear for 5-10s with no visible state — that's worse than a visible spinner on the row. **Recommendation: do not optimistically remove on reclassify → URGENT/OTHER. Only remove on success.** For reclassify → SPAM/AD (no reply agent, fast), optimistic remove is fine.

If the user navigates away mid-reclassify, the 20s poll's `mergeFromServer` won't fully resolve the move (add-only), but the next `refreshStoreFromServer()` (triggered by any subsequent action or a navigation remount of `useDataStream`) will. Acceptable.

---

## 3. Implementation scope

### 3a. Files that need changes

| File                                                                 | Change                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/api/webhooks.ts`                                            | Add `ReclassifyPayload` type + `reclassify(payload)` helper hitting `POST /api/emails/:id/reclassify` with body `{ new_classification }`; throw `WebhookError` on non-2xx. Timeout 30-60s.                                                                                                                                                                                                            |
| `src/views/AdView.tsx`                                               | Extend `renderRowActions` (line 274) to include a 3-button reclassify group (Dringend / Sonstige / Spam); handler uses the optimistic-for-SPAM / spinner-for-URGENT/OTHER pattern from §2d; calls `removeEmail("ads", id)` + `refreshStoreFromServer()` on success; emit `emitAuditEvent({ action: "email_reclassified", ... })` matching the existing audit shape at `src/views/AdView.tsx:170-188`. |
| `src/views/SpamView.tsx`                                             | Pass a new `renderRowActions` prop to `EmailTable` (currently omitted at line 249) with a 3-button reclassify group (Werbung / Dringend / Sonstige); same handler pattern. Add `import { reclassify } from "@/lib/api/webhooks"`.                                                                                                                                                                     |
| `src/views/DraftReviewView.tsx` (used by `UrgentView` + `OtherView`) | Add a "Neu klassifizieren" affordance next to Senden/Ablehnen in the draft editor footer. Only valid targets: Spam / Werbung / (the other draft class). Show a warning Dialog for → Spam/Werbung (destroys `draft_reply` per backend audit §9b).                                                                                                                                                      |
| `src/lib/api/audit.ts`                                               | If the audit helper has an allowlist of actions, add `"email_reclassified"` to it. (Otherwise no change — the helper takes arbitrary action strings.)                                                                                                                                                                                                                                                 |
| `src/lib/store/email-store.ts`                                       | **No change required.** `removeEmail(slice, id)` + `hydrateFromServer` already cover the move. Optional: remove the `console.log` at line 171 while here (unrelated cleanup).                                                                                                                                                                                                                         |
| `src/hooks/useDataStream.ts`                                         | **No change required.** Reclassify uses the action-then-refresh pattern, not the poll.                                                                                                                                                                                                                                                                                                                |

Nice-to-have (not required):

- `src/components/ui/dropdown-menu.tsx` — install if we go with the dropdown UX variant (§2b option 2) instead of inline buttons.

### 3b. Build + deploy

- Vite build: `tsc -b && vite build` per `package.json:8`. No custom `build.outDir` in `vite.config.ts` → Vite default `dist/`. Confirmed: `dist/assets/` and `dist/index.html` exist in the repo.
- `public/` directory does not exist in the frontend repo (no static assets copied in).
- No `postbuild`/`predeploy`/`deploy` script in `package.json`. The frontend repo does **not** automate the copy into the backend's `public/`.
- Per backend audit §10: `install.sh` / `update.sh` in the SiteFlow backend repo pull from `Lukasbrujula/siteware-frontend` and place the build output under the backend's `public/assets/`. That script lives in the backend repo, not this one. The frontend deploy loop is:
  1. Commit + push to `Lukasbrujula/siteware-frontend`.
  2. On the VPS, run the backend's `update.sh`, which clones/pulls the frontend repo, runs `npm ci && npm run build`, and copies `dist/*` into `public/`.
- The shipped bundle the backend audit grepped was `public/assets/index-otHpdlTp.js` — a single minified file per the default Vite config.

### 3c. Risk assessment

Ordered by subtlety (most → least risky):

1. **Race between reclassify reply-agent latency and the 20s `mergeFromServer` poll.** At T=0 user clicks reclassify AD→URGENT. At T+5s the 20s poll fires while the inline reply agent is still running. The poll calls `mergeFromServer` (`src/hooks/useDataStream.ts:46-49`), which is add-only. The AD row still exists with `status='archived'` on the backend until the reply agent finishes and writes `status='draft'`. So the poll returns the row still in the AD bucket — harmless (add-only, row already there). At T+8s the endpoint returns; FE calls `removeEmail("ads", id)` + `refreshStoreFromServer()`. Full hydrate replaces the AD slice, row is gone; row appears in Urgent. **Verdict: safe**, because hydrate is a full replace. But: if the UI optimistically removed the row at T=0 and the user navigates away before T+8s, the unmount kills `useDataStream` and the success path's `refreshStoreFromServer` call. Row is stale-missing until next mount. **Mitigation:** don't optimistic-remove for SPAM/AD → URGENT/OTHER; show a row-level spinner instead (per §2d).

2. **Store state drift when backend stops returning a reclassified row because it's in a terminal state the FE doesn't fetch.** The `GET /api/emails` response shape per backend audit §10 uses `grouped.escalation`, `grouped.spam`, etc. If reclassify moves a draft into `SPAM` and the backend's grouping filters out `status='archived'` rows, the row disappears. The FE hydrate handles absence correctly (sets `spam: data.spam ?? []`). No bug; just verify the backend returns the SPAM-archived row in `grouped.spam` (the existing SPAM view shows archived rows, so this is already the contract — see §1b confirming the retriage flow works the same way).

3. **Type mismatch in the request body.** Backend expects `{ new_classification: "SPAM"|"AD"|"URGENT"|"OTHER" }` (backend audit §9). The existing FE category typing uses uppercase string literals for `SpamAdEmail.category` ("SPAM" | "AD" — see `src/lib/store/email-store.ts:98-109`), so no transformation is needed. Easy to get wrong if someone reuses the lowercase slice keys (`"spam"`, `"ads"`) — worth a discriminated `const` in `webhooks.ts`.

4. **Optimistic update rollback on error.** `SpamView` / `AdView` today don't rollback on failure — they show an error toast and leave the optimistic state as-is for the `Promise.allSettled` path. Because reclassify is single-row (not bulk), a failure should leave the row where it was. **Mitigation:** don't remove optimistically for the slow path (see risk 1). For the fast path (→ SPAM/AD), if the backend fails, the optimistic `removeEmail` is wrong — follow the existing pattern: remove only on `result.status === "fulfilled"` (per `src/views/SpamView.tsx:141-162`).

5. **The `console.log` at `src/lib/store/email-store.ts:171`.** Not a reclassify bug but violates the project's "no `console.log` in commits" rule. Clean up opportunistically.

Risks 1 and 4 interact and are the ones that need actual design thought. Risks 2, 3, 5 are mechanical.

---

## Proposed Approach

Add one helper, wire three views, no store changes. `src/lib/api/webhooks.ts` gains `reclassify(payload: { email_id, new_classification })` following the exact shape of the existing `retriage` helper but sending only `{ new_classification }` (the backend ignores the `retriage` body anyway, per backend audit §10 — the new endpoint gets a clean contract). `SpamView` and `AdView` attach `renderRowActions` to `EmailTable` to put three small classification buttons in the Aktionen column; `DraftReviewView` adds the same affordance to the draft-editor footer. On reclassify → SPAM/AD (backend is fast, no reply agent), follow the existing retriage pattern: optimistic `removeEmail(oldSlice, id)` → `await refreshStoreFromServer()` → toast. On reclassify → URGENT/OTHER (backend takes 5-10s for the inline reply-agent call per backend audit §9c-ii), hold the row in place with a per-row spinner until the HTTP response; only then remove + hydrate. The 20s poll is safe alongside both paths because it's add-only. Complexity verdict: **easy-to-medium** — ~100 lines of FE code across 3-4 files, reusing the existing helper/error/audit/toast patterns with no new primitives required (optional: shadcn `DropdownMenu` if the inline button group feels cramped at the row level). Remaining cross-repo unknowns: (a) the exact response shape of `POST /api/emails/:id/reclassify` — does it return the updated email object the FE should splice in, or just `{ message }` (backend audit §12 shows `{ message: "Reclassified, draft generated" }`)? If just `{ message }`, we rely on `refreshStoreFromServer()` as currently planned; if it returns the full updated email, we can skip the extra GET; (b) whether `GET /api/emails` includes reclassified-to-SPAM-with-nulled-draft rows in `grouped.spam` (should already be the case per retriage precedent, worth confirming once the endpoint ships); (c) whether the German label "Werbung" vs the backend enum "AD" alignment needs any mapping in the reclassify helper — trivial, but call it out in the PR.
