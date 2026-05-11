# Audit: Settings → Add-Inbox Flow

**Date:** 2026-05-11  
**Scope:** Read-only code audit — no modifications made.  
**Working dir confirmed:** `/Users/lukasmargenfeld/clients/Siteware/siteware-frontend` (via `pwd`)

---

## 1. Component rendering `/settings`

**File:** `src/views/SettingsView.tsx`  
**Route wired in:** `src/main.tsx` line 17 — `<Route path="/settings" element={<SettingsView />} />`

**What it does:**

- Fetches the tenant list via `GET /api/onboarding/tenants` on mount.
- Renders three states: loading spinner, error panel, or the tenant list.
- Each tenant row shows: colored active/inactive dot, `imap_user` (or `tenant_id` fallback), creation date, an active toggle switch (calls `POST /api/onboarding/tenant-toggle`), and a trash icon.
- Clicking the trash opens a shadcn `<Dialog>` confirmation; confirmed delete calls `POST /api/onboarding/tenant-delete`.
- Below the tenant list, renders `<ToneSettingsPanel />` when the user is verified.
- All API calls use raw `fetch` directly inside the component (no API wrapper module).

---

## 2. "+ Neues Konto" button — exact onClick

**File:** `src/views/SettingsView.tsx`, lines 151–156

```tsx
<Link to="/onboarding">
  <Button size="sm" className="cursor-pointer gap-1.5">
    <Plus className="size-4" />
    Neues Konto
  </Button>
</Link>
```

There is **no `onClick` handler**. The `<Button>` is wrapped in a React Router `<Link to="/onboarding">`. Clicking it is a client-side navigation to `/onboarding` — no modal, no state, no fetch. Identical empty-state CTA at lines 183–189.

---

## 3. `/onboarding` route — component and guard

**File:** `src/views/OnboardingView.tsx`  
**Route wired in:** `src/main.tsx` line 18 — `<Route path="/onboarding" element={<OnboardingView />} />`

**What it does:**

- Guards: redirects to `/login` if not verified; redirects to `/` if the user's role is not `"admin"` (case-insensitive).
- Manages a 5-step wizard with local `useState` — steps: Zugangsdaten → E-Mail-Scan → Website → Schreibstil → Bestätigung.
- Accumulates wizard state in an `OnboardingState` object; each step receives `onUpdate` + `onNext` callbacks.
- No sub-routes — all 5 steps live inside a single `/onboarding` URL.

---

## 4. Reusable modal/dialog component

**File:** `src/components/ui/dialog.tsx`  
**Exports:** `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`, `DialogOverlay`, `DialogPortal`  
**Built on:** Radix UI `Dialog` primitive (`radix-ui` package).

`SettingsView.tsx` already imports and uses this component for the delete confirmation (lines 278–317). The pattern is fully established:

```tsx
<Dialog open={someBoolean} onOpenChange={(open) => { if (!open) setX(null) }}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>…</DialogTitle>
      <DialogDescription>…</DialogDescription>
    </DialogHeader>
    {/* body */}
    <DialogFooter>
      <Button variant="outline" onClick={…}>Abbrechen</Button>
      <Button variant="destructive" onClick={…}>Bestätigen</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

`DialogContent` defaults to `max-w-lg`, has built-in close-X button (`showCloseButton` prop, default `true`), enter/exit animations, and a backdrop overlay.

---

## 5. Step1Credentials.tsx — fields collected and POST shape

**File:** `src/components/onboarding/Step1Credentials.tsx`

### Fields collected

| Field           | Input type              | Description                         |
| --------------- | ----------------------- | ----------------------------------- |
| `email`         | `email`                 | E-Mail-Adresse                      |
| `password`      | `password` (toggleable) | App-Passwort or Passwort            |
| `imapHost`      | `text`                  | IMAP Host (pre-filled by provider)  |
| `imapPort`      | `number`                | IMAP Port (pre-filled, default 993) |
| `smtpHost`      | `text`                  | SMTP Host (pre-filled by provider)  |
| `smtpPort`      | `number`                | SMTP Port (pre-filled, default 465) |
| `sitewareToken` | `password` (toggleable) | Siteware API-Schlüssel              |
| `replyAgentId`  | `text`                  | Reply Agent ID                      |

Provider selector (9 presets + "Andere") auto-fills `imapHost/Port/smtpHost/Port`.

### "Verbindung testen" POST (lines 191–224)

**Endpoint:** `POST /api/onboarding/test-connection`  
**Headers:** `Content-Type: application/json`  
**Body:**

```json
{
  "email": "string",
  "password": "string",
  "imapHost": "string",
  "imapPort": 993,
  "smtpHost": "string",
  "smtpPort": 465
}
```

_(Note: `sitewareToken` and `replyAgentId` are NOT sent in the test connection call — only IMAP/SMTP credentials.)_

**Response shape expected:**

```json
{ "success": true }
// or
{ "success": false, "error": "string" }
```

Button is disabled until all 8 fields are non-empty (`isFormValid`). "Weiter" is disabled until `testState === "success"`.

### `handleContinue` payload passed upstream (lines 226–239)

```ts
const credentials: Credentials = {
  email,
  password,
  imapHost,
  imapPort: Number(imapPort),
  smtpHost,
  smtpPort: Number(smtpPort),
  sitewareToken,
  replyAgentId,
};
onUpdate({ credentials });
onNext();
```

---

## Questions

### A. Is there ANY add-inbox UI flow that doesn't route through `/onboarding`?

**No.**

Evidence:

- The only entry points to adding a new account are both `<Link to="/onboarding">` nodes in `SettingsView.tsx` (lines 151 and 183).
- `main.tsx` defines exactly 4 routes: `/`, `/login`, `/settings`, `/onboarding`. There is no `/add-inbox`, `/inbox/new`, or modal-based add flow.
- No `fetch` call to any onboarding creation endpoint exists outside of the wizard step components (`Step1Credentials.tsx` through `Step5Confirm.tsx`).

### B. What does the inbox-list rendering look like on `/settings`?

**File:** `src/views/SettingsView.tsx`, lines 192–261

```tsx
{
  loadState === "loaded" && tenants.length > 0 && (
    <div className="divide-y rounded-lg border bg-background">
      {tenants.map((tenant) => (
        <div
          key={tenant.tenant_id}
          className="flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`size-2.5 shrink-0 rounded-full ${
                tenant.active === 1 ? "bg-green-500" : "bg-gray-300"
              }`}
              title={tenant.active === 1 ? "Aktiv" : "Inaktiv"}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {tenant.imap_user ?? tenant.tenant_id}
              </p>
              <p className="text-xs text-muted-foreground">
                Erstellt am{" "}
                {new Date(tenant.created_at).toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
          {/* toggle switch + trash button */}
        </div>
      ))}
    </div>
  );
}
```

An email address like `lukasmargenfeld@icloud.com` appears via `tenant.imap_user` — that field comes from the `GET /api/onboarding/tenants` response (the `Tenant` type at lines 16–23). The component does not hardcode any email; it's purely data-driven from the API.

### C. HTTP client / API wrapper

**Pattern:** Raw `fetch` throughout — no Axios, no client class.

Two locations:

1. **`src/lib/api/webhooks.ts`** — encapsulates all email-action calls (approve, reject, retriage, unsubscribe, reclassify) as typed async functions. Uses a shared `emailUrl()` helper and `parseErrorDetail()`. Throws `WebhookError` (custom Error subclass) on non-ok responses.
2. **`src/lib/api/emails.ts`** — encapsulates `fetchInboxes()`, `refreshStoreFromServer()`, `deleteEmailFromServer()`, `updateEmailStatus()`. Uses `AbortSignal.timeout(10_000)` for timeouts.
3. **`src/lib/api/headers.ts`** — thin helper `apiHeaders(extra?)` that just spreads extra headers; currently a no-op (returns `{ ...extra }`).
4. **`src/views/SettingsView.tsx`** — calls `fetch` directly (not via wrapper) for all three onboarding-management endpoints (`/api/onboarding/tenants`, `/api/onboarding/tenant-toggle`, `/api/onboarding/tenant-delete`).
5. **`src/components/onboarding/Step1Credentials.tsx`** — calls `fetch` directly for `POST /api/onboarding/test-connection`.

**Summary:** No unified API client. The email-action calls are well-encapsulated in `webhooks.ts` / `emails.ts`. Onboarding/settings calls are inline in component bodies.

### D. Reusable form component?

**No shared form component.** Each component hand-rolls its own forms using:

- Individual `useState` per field
- Controlled `<Input>` from shadcn/ui
- Manual validation (`isFormValid` boolean derived inline)
- No React Hook Form, no Formik, no Zod schema validation

Pattern from `Step1Credentials.tsx` is representative:

```ts
const [email, setEmail] = useState("")
const isFormValid = email.trim() !== "" && password.trim() !== "" && /* ... */
```

The shadcn `<Input>` and `<Label>` atoms are shared. No molecule-level `<FormField>` component exists.

### E. "Verbindung testen" — endpoint and reusability

**Endpoint:** `POST /api/onboarding/test-connection`  
**Body:** `{ email, password, imapHost, imapPort, smtpHost, smtpPort }` (all strings/numbers, no token)

**Pattern is fully reusable for an add-inbox modal.** The test-connection call lives inside `handleTestConnection` (lines 191–224) and is self-contained — it reads from local state and calls a single endpoint. To port it to a modal:

1. Lift the 8 field states + `testState` into the modal component.
2. Keep the `fetch("/api/onboarding/test-connection", ...)` call verbatim.
3. Wire the existing `<Button variant="outline">Verbindung testen</Button>` pattern — already used in `SettingsView` for the delete Dialog.
4. On success, call whatever POST creates a new tenant (currently `Step5Confirm.tsx` handles provisioning — that's the endpoint to extract).

The only difference vs. the full wizard: the modal only needs Steps 1 + 5 (credentials + confirm/save). Steps 2–4 (scan sent, website scrape, tone analysis) are optional enrichment that could be deferred to a post-add settings screen.

---

## Calibration Block

| Item                                 | File                                               | Lines                 |
| ------------------------------------ | -------------------------------------------------- | --------------------- |
| `/settings` route component          | `src/views/SettingsView.tsx`                       | 27–320                |
| "+ Neues Konto" button               | `src/views/SettingsView.tsx`                       | 151–156               |
| Empty-state CTA                      | `src/views/SettingsView.tsx`                       | 183–189               |
| `/onboarding` route component        | `src/views/OnboardingView.tsx`                     | 60–201                |
| Route definitions                    | `src/main.tsx`                                     | 13–21                 |
| Reusable Dialog                      | `src/components/ui/dialog.tsx`                     | 1–157                 |
| Dialog used in SettingsView          | `src/views/SettingsView.tsx`                       | 278–317               |
| Step1Credentials component           | `src/components/onboarding/Step1Credentials.tsx`   | 153–481               |
| `handleTestConnection`               | `src/components/onboarding/Step1Credentials.tsx`   | 191–224               |
| `handleContinue` / credentials shape | `src/components/onboarding/Step1Credentials.tsx`   | 226–239               |
| `Credentials` type                   | `src/components/onboarding/Step1Credentials.tsx`   | 16–25                 |
| Tenant list JSX                      | `src/views/SettingsView.tsx`                       | 192–261               |
| API wrappers                         | `src/lib/api/webhooks.ts`, `src/lib/api/emails.ts` | —                     |
| Inline onboarding fetch calls        | `src/views/SettingsView.tsx`                       | 39–58, 73–98, 107–123 |
