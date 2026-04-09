# Codebase Audit — Siteware Email Inbox Automation Dashboard

**Status:** MVP Complete (Tasks 01-08)
**Date:** 2026-03-03
**Purpose:** Developer handover document

---

## 1. Executive Summary

The Siteware Email Inbox Automation Dashboard is a React SPA that serves as the human-in-the-loop interface for an AI-powered email automation system. It is embedded inside the Siteware SiteFlow platform.

**How it works:**

1. n8n workflows classify incoming emails into 6 categories (Spam, Ads, Urgent, Other, Escalation, Unsubscribe)
2. n8n drafts replies for actionable emails and detects escalations
3. Classified emails are pushed to this dashboard via an Express server + SSE
4. Users review, approve, reject, retriage, or unsubscribe through the dashboard UI
5. User actions are sent back to n8n via webhook calls

**Key constraints:**

- No database — all data is ephemeral, held in Zustand (in-memory)
- No authentication — the Siteware platform handles auth externally
- No SSR — this is a Vite SPA, not Next.js
- DSGVO/GDPR compliant — no external resources, no analytics, no data persistence

---

## 2. Architecture Overview

```
┌─────────────────┐                                    ┌──────────────────┐
│  IMAP Mailbox    │                                    │  Siteware SiteFlow│
│  (Email Source)  │                                    │  (Hosting/Auth)  │
└────────┬────────┘                                    └────────┬─────────┘
         │                                                      │ embeds
         ▼                                                      ▼
┌─────────────────┐  POST /api/email/:category  ┌──────────────────────────┐
│                 │ ──────────────────────────►  │   Express Server         │
│  n8n Workflows  │                              │   (port 3002)            │
│                 │                              │                          │
│  - Classify     │                              │   - Validates payload    │
│  - Draft reply  │                              │   - XSS detection        │
│  - Detect       │                              │   - Broadcasts via SSE   │
│    escalation   │                              │   - Writes audit log     │
│  - Unsubscribe  │                              └────────────┬─────────────┘
│                 │                                           │ SSE /events
│                 │                                           ▼
│                 │                              ┌──────────────────────────┐
│                 │                              │   React SPA (Vite)       │
│                 │                              │                          │
│                 │  POST /webhook/*             │   useDataStream() hook   │
│                 │ ◄───────────────────────────  │   → Zustand store        │
│                 │  (approve, reject,           │   → 6 category views     │
│                 │   retriage, unsubscribe)     │   → User actions         │
└─────────────────┘                              └──────────────────────────┘
```

**Runtime components:**

- **Vite dev server** (port 5173) — serves the React SPA, proxies `/api/*` and `/events` to Express
- **Express server** (port 3002) — data ingestion, SSE broadcasting, audit logging, health check
- **n8n instance** (external) — email classification, draft generation, webhook receivers

**State management:**

- Zustand store with 6 slices: `spam`, `ads`, `urgent`, `other`, `escalations`, `unsubscribes`
- Max 500 items per slice, duplicate prevention by `email_id`
- Immutable update patterns throughout
- UI state (active tab, selected email, draft editor content) in separate `ui-store`

---

## 3. Technology Stack

### Production Dependencies (13)

| Package                    | Version  | Purpose                                                |
| -------------------------- | -------- | ------------------------------------------------------ |
| `react`                    | ^19.2.0  | UI framework                                           |
| `react-dom`                | ^19.2.0  | React DOM renderer                                     |
| `zustand`                  | ^5.0.11  | In-memory state management (6 email slices + UI state) |
| `express`                  | ^5.2.1   | Data ingestion server with SSE endpoint                |
| `cors`                     | ^2.8.6   | CORS middleware for Express (whitelist-based)          |
| `tailwindcss`              | ^4.2.1   | Utility-first CSS framework                            |
| `@tailwindcss/vite`        | ^4.2.1   | Tailwind CSS Vite plugin                               |
| `radix-ui`                 | ^1.4.3   | Unstyled accessible UI primitives (used via shadcn/ui) |
| `class-variance-authority` | ^0.7.1   | Type-safe component variants for shadcn/ui             |
| `clsx`                     | ^2.1.1   | Conditional className utility                          |
| `tailwind-merge`           | ^3.5.0   | Merge Tailwind classes without conflicts               |
| `lucide-react`             | ^0.576.0 | Icon library (tree-shakeable, individual imports)      |
| `sonner`                   | ^2.0.7   | Toast notification system                              |

### Development Dependencies (15)

| Package                       | Version  | Purpose                                                        |
| ----------------------------- | -------- | -------------------------------------------------------------- |
| `typescript`                  | ~5.9.3   | Type checking (strict mode)                                    |
| `vite`                        | ^7.3.1   | Build tool and dev server                                      |
| `@vitejs/plugin-react`        | ^5.1.1   | React Fast Refresh for Vite                                    |
| `tsx`                         | ^4.21.0  | TypeScript execution for Express server (`npm run dev:server`) |
| `eslint`                      | ^9.39.1  | Code linting                                                   |
| `eslint-plugin-react-hooks`   | ^7.0.1   | React hooks linting rules                                      |
| `eslint-plugin-react-refresh` | ^0.4.24  | React Refresh boundary linting                                 |
| `typescript-eslint`           | ^8.48.0  | TypeScript ESLint integration                                  |
| `@eslint/js`                  | ^9.39.1  | ESLint core JavaScript rules                                   |
| `globals`                     | ^16.5.0  | Global variable definitions for ESLint                         |
| `@types/cors`                 | ^2.8.19  | TypeScript types for cors                                      |
| `@types/express`              | ^5.0.6   | TypeScript types for Express                                   |
| `@types/node`                 | ^24.11.0 | TypeScript types for Node.js                                   |
| `@types/react`                | ^19.2.7  | TypeScript types for React                                     |
| `@types/react-dom`            | ^19.2.3  | TypeScript types for React DOM                                 |

### Notable Absences (by design)

- No `axios` — native `fetch` with `AbortSignal.timeout()`
- No database driver — all data is in-memory
- No auth library — Siteware platform handles authentication
- No analytics — DSGVO compliance, no Google Analytics / Mixpanel / Segment
- No external font CDN — no Google Fonts

---

## 4. Project Structure

```
siteware-email-dashboard/
├── index.html                    # Minimal HTML shell (lang="de", no external scripts)
├── package.json                  # Dependencies and npm scripts
├── vite.config.ts                # Vite config with dev proxy + path aliases
├── tsconfig.app.json             # TypeScript config for frontend (excludes server/)
├── tsconfig.node.json            # TypeScript config for Vite config file
├── tsconfig.server.json          # TypeScript config for Express server + types/
├── CLAUDE.md                     # Project rules and AI assistant instructions
├── README.md                     # Setup guide and architecture overview
│
├── src/
│   ├── main.tsx                  # React entry point (StrictMode + createRoot)
│   ├── App.tsx                   # Root component: mock data seeding, SSE connection, layout
│   ├── index.css                 # Tailwind CSS entry point
│   │
│   ├── components/
│   │   ├── ui/                   # 8 shadcn/ui primitives
│   │   │   ├── badge.tsx         #   Badge with variant props (default, secondary, destructive, outline)
│   │   │   ├── button.tsx        #   Button with variant + size props (includes xs size)
│   │   │   ├── card.tsx          #   Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
│   │   │   ├── dialog.tsx        #   Dialog, DialogTrigger, DialogContent, DialogHeader, etc.
│   │   │   ├── table.tsx         #   Table, TableHeader, TableBody, TableRow, TableHead, TableCell
│   │   │   ├── tabs.tsx          #   Tabs, TabsList, TabsTrigger, TabsContent
│   │   │   ├── textarea.tsx      #   Textarea with forwardRef
│   │   │   └── sonner.tsx        #   Toaster wrapper for Sonner
│   │   │
│   │   ├── layout/               # 2 layout components
│   │   │   ├── DashboardHeader.tsx  # Top header with logo + action count badge
│   │   │   └── CategoryTabs.tsx     # 6-tab navigation (Spam, Werbung, Dringend, etc.)
│   │   │
│   │   └── email/                # 9 email-specific components
│   │       ├── EmailTable.tsx       # Reusable table for Spam/Ad views (select, expand, row actions)
│   │       ├── DraftEditor.tsx      # Draft editor with placeholder highlighting, approve/reject
│   │       ├── DraftList.tsx        # Left-panel draft list for DraftReviewView
│   │       ├── OriginalEmail.tsx    # Original email display for draft review
│   │       ├── SentimentBadge.tsx   # Color-coded sentiment score badge (-1 to +1)
│   │       ├── RiskFlags.tsx        # Complaint risk, legal threat, churn risk indicators
│   │       ├── UnsubscribeTable.tsx # Table for unsubscribe status entries
│   │       ├── UnsubscribeStatusBadge.tsx  # "erfolgreich" / "nicht erfolgreich" badge
│   │       └── UnsubscribeMethodBadge.tsx  # "one-click" / "mailto" / "not-found" badge
│   │
│   ├── views/                    # 7 view files for 6 category tabs
│   │   ├── SpamView.tsx             # Spam emails: bulk select, delete, retriage
│   │   ├── AdView.tsx               # Ad emails: bulk select, delete, retriage, per-row unsubscribe
│   │   ├── UrgentView.tsx           # Wrapper → DraftReviewView(slice="urgent")
│   │   ├── OtherView.tsx            # Wrapper → DraftReviewView(slice="other")
│   │   ├── DraftReviewView.tsx      # Shared two-column draft review (list + editor)
│   │   ├── EscalationView.tsx       # Card-based escalation alerts with severity sorting
│   │   └── UnsubscribeView.tsx      # Unsubscribe status table with retry
│   │
│   ├── hooks/
│   │   └── useDataStream.ts      # SSE EventSource hook → Zustand store hydration
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── webhooks.ts       # 4 webhook calls to n8n (approve, reject, retriage, unsubscribe)
│   │   │   └── audit.ts          # Client-side audit event emitter (fire-and-forget, 5s timeout)
│   │   ├── store/
│   │   │   ├── email-store.ts    # Zustand store: 6 slices, addEmail, removeEmail, updateEmail, clearCategory
│   │   │   └── ui-store.ts       # UI state: activeTab, selectedEmailId, draftEditorContent
│   │   ├── mock-data.ts          # Mock data for all 6 categories
│   │   └── seed-store.ts         # Seeds Zustand store with mock data (when VITE_USE_MOCK_DATA=true)
│   │
│   ├── types/
│   │   ├── email.ts              # SpamAdEmail, DraftEmail, EscalationAlert, UnsubscribeStatus, etc.
│   │   ├── webhook.ts            # ApproveDraftRequest, RejectDraftRequest, RetriageRequest, etc.
│   │   └── audit.ts              # AuditAction (10 types), AuditEvent, AuditLogEntry
│   │
│   └── server/                   # Express data ingestion server
│       ├── index.ts              # Express app: routes, CORS, JSON limit, SSE, audit endpoint
│       ├── sse.ts                # SSE client manager: addClient, broadcast, heartbeat, cleanup
│       ├── validation.ts         # Runtime validators for all 4 payload types + XSS detection
│       └── audit.ts              # Server-side audit: validateAuditPayload, writeAuditLog (stdout)
│
├── docs/                         # Documentation (read-only reference)
│   ├── Siteware_Knowledge_Base.md
│   ├── Siteware_System_Instructions.md
│   ├── Siteware_Project_Status.md
│   └── Siteware_API_Reference.md
│
└── TASKS/                        # Atomic task files (9-pillar format)
```

**File count:** ~40 source files, ~30 in `src/`

---

## 5. Features Built (The Six Category Views)

### 5.1 Spam (`SpamView.tsx`)

**German label:** Spam
**Zustand slice:** `spam` (type: `SpamAdEmail[]`)

| Feature             | Implementation                                                                        |
| ------------------- | ------------------------------------------------------------------------------------- |
| Email table         | `EmailTable` component with sender, subject, date, confidence columns                 |
| Bulk select         | Checkbox per row + select-all toggle, `selectedIds` as `ReadonlySet<string>`          |
| Expandable rows     | Click to expand reasoning + confidence details                                        |
| Delete selected     | Removes from Zustand store (local-only, no IMAP delete — see limitations)             |
| Move to Inbox       | Calls `retriage` webhook per email via `Promise.allSettled`, partial failure handling |
| Loading states      | `isRetriaging` state disables button, shows `Loader2` spinner                         |
| Toast notifications | Success/error via Sonner with German messages                                         |
| Audit logging       | `email_deleted` and `email_retriaged` events emitted                                  |

### 5.2 Werbung / Advertising (`AdView.tsx`)

**German label:** Werbung
**Zustand slice:** `ads` (type: `SpamAdEmail[]`)

All Spam features plus:

| Feature                    | Implementation                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Unsubscribe indicator      | Green checkmark if `unsubscribe_available`, grey X if not                           |
| Per-row unsubscribe button | Calls `unsubscribe` webhook with `list_unsubscribe_url` / `list_unsubscribe_mailto` |
| Per-row loading            | `unsubscribingId` tracks which email is being unsubscribed                          |
| Audit logging              | `unsubscribe_requested` event emitted                                               |

### 5.3 Dringend / Urgent (`UrgentView.tsx` → `DraftReviewView.tsx`)

**German label:** Dringend
**Zustand slice:** `urgent` (type: `DraftEmail[]`)

| Feature                  | Implementation                                                                  |
| ------------------------ | ------------------------------------------------------------------------------- |
| Two-column layout        | Left: draft list (`DraftList`), Right: original email + draft editor            |
| Draft list               | Clickable items showing sender, subject, confidence, low-confidence badge       |
| Original email display   | `OriginalEmail` component showing sender, subject, preview, sentiment           |
| Draft editor             | `DraftEditor` with editable `Textarea`, synced to `ui-store.draftEditorContent` |
| Placeholder highlighting | `[BITTE ERGÄNZEN: ...]` text highlighted yellow in draft                        |
| Approve button           | Disabled when placeholders remain; calls `approveDraft` webhook                 |
| Reject button            | Opens `Dialog` for optional reason; calls `rejectDraft` webhook                 |
| Submitting state         | `submittingAction` tracks `'approve'` or `'reject'`, shows spinner              |
| Auto-archive             | Email removed from store after successful approve/reject                        |
| Audit logging            | `draft_approved` and `draft_rejected` events with context                       |

### 5.4 Sonstige / Other (`OtherView.tsx` → `DraftReviewView.tsx`)

**German label:** Sonstige
**Zustand slice:** `other` (type: `DraftEmail[]`)

Identical to Urgent — same `DraftReviewView` component, different slice.

### 5.5 Eskalation / Escalation (`EscalationView.tsx`)

**German label:** Eskalation
**Zustand slice:** `escalations` (type: `EscalationAlert[]`)

| Feature           | Implementation                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Card-based layout | Each escalation rendered as a `Card` (not a table)                                        |
| Severity sorting  | Sorted by `legal_threat` (true first), then `sentiment_score` (lowest first)              |
| Urgency badge     | Color-coded: red >= 4, default >= 3, grey < 3                                             |
| Sentiment badge   | `SentimentBadge` component with color gradient from -1 (red) to +1 (green)                |
| Risk flags        | `RiskFlags` component: complaint risk, legal threat, churn risk (low/medium/high)         |
| Summary           | Displayed in a muted border box                                                           |
| Acknowledge       | Sets `acknowledged` state, reduces card opacity                                           |
| Assign            | Dropdown with 4 options: Teamleitung, Rechtsabteilung, Kundenbetreuer, Geschaeftsfuehrung |
| Dismiss           | Only available after acknowledge; removes from store                                      |
| Audit logging     | `escalation_acknowledged`, `escalation_assigned`, `escalation_dismissed` events           |

**Limitation:** Assignment is local-only — no notification webhook exists yet.

### 5.6 Abmeldungen / Unsubscribe (`UnsubscribeView.tsx`)

**German label:** Abmeldungen
**Zustand slice:** `unsubscribes` (type: `UnsubscribeStatus[]`)

| Feature         | Implementation                                                             |
| --------------- | -------------------------------------------------------------------------- |
| Status table    | `UnsubscribeTable` with sender, method, status, reason columns             |
| Method badge    | `UnsubscribeMethodBadge`: "one-click", "mailto", "not-found"               |
| Status badge    | `UnsubscribeStatusBadge`: "erfolgreich" (green), "nicht erfolgreich" (red) |
| Retry button    | For failed entries; calls `unsubscribe` webhook                            |
| Per-row loading | `retryingIds` as `ReadonlySet<string>` tracks active retries               |
| Audit logging   | `unsubscribe_retried` event emitted                                        |

---

## 6. Data Flow & Integration

### 6.1 Inbound: n8n → Dashboard

```
n8n workflow
  │
  ├── POST /api/email/spam         (SpamAdEmail, category: "SPAM")
  ├── POST /api/email/ad           (SpamAdEmail, category: "AD")
  ├── POST /api/email/draft        (DraftEmail, category: "URGENT" | "OTHER")
  ├── POST /api/email/escalation   (EscalationAlert, category: "ESCALATION")
  └── POST /api/email/unsubscribe  (UnsubscribeStatus, no category field)
        │
        ▼
  Express server (src/server/index.ts)
    1. CORS check (whitelist-based)
    2. JSON parse (16KB limit)
    3. Route validation (category must be: spam, ad, draft, escalation, unsubscribe)
    4. Payload validation (src/server/validation.ts)
       - Type checks: string, number, boolean, array
       - Length limits: email_id max 200, subject max 1000, draft_html max 100,000
       - Range checks: confidence 0-1, sentiment_score -1 to 1, urgency 0-10
       - Enum checks: category, churn_risk, unsubscribe_method, status, reply_language
       - XSS detection: <script>, on*= event handlers, javascript: protocol
    5. Category mismatch check (route vs payload.category)
    6. Audit log: email_ingested event
    7. SSE broadcast to all connected clients
        │
        ▼
  SSE /events (src/server/sse.ts)
    - event: "email", data: JSON payload
    - Max 50 simultaneous clients
    - 30s heartbeat interval
    - Dead client cleanup on write failure
        │
        ▼
  React SPA (src/hooks/useDataStream.ts)
    - EventSource connects to /events
    - "connected" event → sets clientId + status
    - "email" event → JSON.parse → useEmailStore.addEmail()
        │
        ▼
  Zustand store (src/lib/store/email-store.ts)
    - Routes by category field (or structural check for UnsubscribeStatus)
    - Duplicate prevention by email_id
    - 500-item capacity cap per slice (oldest dropped)
```

### 6.2 Outbound: Dashboard → n8n

All webhook calls go through `src/lib/api/webhooks.ts`:

| Webhook        | Path             | Trigger                     | Payload Fields                                                                       |
| -------------- | ---------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `approveDraft` | `/approve-draft` | User approves draft         | `email_id`, `draft_html`, `draft_plain`, `sender_email`, `subject`, `reply_language` |
| `rejectDraft`  | `/reject-draft`  | User rejects draft          | `email_id`, `reason?`                                                                |
| `retriage`     | `/retriage`      | User moves spam/ad to inbox | `email_id`, `sender_email`, `subject`, `original_category`                           |
| `unsubscribe`  | `/unsubscribe`   | User triggers unsubscribe   | `email_id`, `sender_email`, `list_unsubscribe_url?`, `list_unsubscribe_mailto?`      |

**Webhook implementation details:**

- Base URL from `VITE_N8N_WEBHOOK_BASE_URL` environment variable
- Native `fetch` with `Content-Type: application/json`
- 15-second timeout via `AbortSignal.timeout(15_000)`
- `WebhookError` class with `status` and `endpoint` fields
- Error message in German: "Webhook fehlgeschlagen (HTTP {status})"

### 6.3 Real-Time (SSE)

**Implementation:** `src/server/sse.ts`

| Parameter           | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| Max clients         | 50                                                     |
| Heartbeat interval  | 30 seconds                                             |
| Heartbeat format    | `: heartbeat\n\n` (SSE comment)                        |
| Event types         | `connected` (on join), `email` (on ingestion)          |
| Client ID           | UUID v4 via `crypto.randomUUID()`                      |
| Dead client cleanup | On heartbeat write failure and broadcast write failure |
| Connection cleanup  | On `res.close` event                                   |

**Client-side:** `src/hooks/useDataStream.ts`

- Connection status: `connecting` → `connected` / `error` / `disconnected`
- Disabled when `VITE_USE_MOCK_DATA=true` (default for development)
- EventSource auto-reconnects on failure (browser-native behavior)

---

## 7. Server Infrastructure

### Express Server (`src/server/index.ts`)

| Setting         | Value                                  | Source                            |
| --------------- | -------------------------------------- | --------------------------------- |
| Port            | 3002 (configurable)                    | `VITE_DASHBOARD_API_PORT` env var |
| CORS origins    | `http://localhost:5173` (configurable) | `DASHBOARD_CORS_ORIGINS` env var  |
| CORS methods    | `GET`, `POST`                          | Hardcoded                         |
| JSON body limit | 16KB                                   | `express.json({ limit: '16kb' })` |
| Express version | 5.x                                    | `package.json`                    |

### Endpoints

| Method | Path                   | Purpose                                      |
| ------ | ---------------------- | -------------------------------------------- |
| GET    | `/events`              | SSE stream (real-time email push)            |
| GET    | `/api/health`          | Health check (returns `{ status, clients }`) |
| POST   | `/api/email/:category` | Data ingestion (5 categories)                |
| POST   | `/api/audit`           | Audit log receiver                           |

### Vite Dev Proxy (`vite.config.ts`)

In development, Vite proxies these paths to the Express server:

- `/api/*` → `http://localhost:3002`
- `/events` → `http://localhost:3002`

### Runtime Validation (`src/server/validation.ts`)

4 validators, one per payload shape:

| Validator                    | Used For                           | Key Checks                                                                                                                                                                                                     |
| ---------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateSpamAdPayload`      | `/api/email/spam`, `/api/email/ad` | 13 fields: workflow, category, email*id, sender*\*, subject, preview, date, confidence (0-1), low_confidence, reasoning, unsubscribe fields                                                                    |
| `validateDraftPayload`       | `/api/email/draft`                 | 18 fields: all base fields + original_subject, original_preview, draft_html (max 100K), draft_plain (max 100K), placeholders array, reply_language (de/en), sentiment_score (-1 to 1), XSS check on draft_html |
| `validateEscalationPayload`  | `/api/email/escalation`            | 12 fields: all base fields + sentiment_score, urgency (0-10), complaint_risk, legal_threat, churn_risk (low/medium/high), summary                                                                              |
| `validateUnsubscribePayload` | `/api/email/unsubscribe`           | 6 fields: email_id, sender, unsubscribe_method (one-click/mailto/not-found), status (erfolgreich/nicht erfolgreich), reason, timestamp                                                                         |

**XSS detection** (`containsDangerousHtml`):

- Blocks `<script` tags (case-insensitive)
- Blocks `on*=` event handler attributes (case-insensitive)
- Blocks `javascript:` protocol (case-insensitive)
- Applied only to `draft_html` field

---

## 8. DSGVO/GDPR Compliance

### Compliance Controls

| #   | Control                       | Implementation                                                                        | Evidence                                                                                                          |
| --- | ----------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | **No data persistence**       | Zustand in-memory store only; 500-item cap per slice; all data cleared on page reload | No `localStorage`, `sessionStorage`, `indexedDB`, or cookie usage in codebase                                     |
| 2   | **No external analytics**     | Zero tracking packages installed                                                      | `package.json` contains no analytics SDKs (no GA, Mixpanel, Segment, Plausible)                                   |
| 3   | **No CDN fonts or scripts**   | All assets self-hosted via Vite bundle                                                | `index.html` contains only `<script type="module" src="/src/main.tsx">` — no external `<link>` or `<script>` tags |
| 4   | **No third-party data leaks** | Minimal HTML shell, no external resources                                             | `index.html` is 12 lines: DOCTYPE, charset, viewport, title, root div, local script                               |
| 5   | **Input validation**          | Server-side validation on all 5 ingestion endpoints                                   | `src/server/validation.ts`: type, length, range, and enum checks on every field                                   |
| 6   | **XSS prevention**            | Dangerous HTML pattern detection                                                      | `containsDangerousHtml()` blocks `<script>`, `on*=`, `javascript:` in `draft_html`                                |
| 7   | **CORS restriction**          | Whitelist-based origin control                                                        | `cors({ origin: allowedOrigins, methods: ['GET', 'POST'] })` in `src/server/index.ts:21`                          |
| 8   | **Audit logging**             | Structured JSON audit trail to stdout                                                 | `src/server/audit.ts` + `src/lib/api/audit.ts` — 10 action types tracked                                          |
| 9   | **Audit trail fields**        | IP tracking, timestamps, action context                                               | `AuditLogEntry` includes `source_ip`, ISO `timestamp`, `action`, `email_id`, optional `context`                   |
| 10  | **Request size limits**       | 16KB JSON payload maximum                                                             | `express.json({ limit: '16kb' })` in `src/server/index.ts:22`                                                     |
| 11  | **Frankfurt hosting**         | All processing on Siteware DE infrastructure                                          | Siteware SiteFlow platform constraint; no external API calls except n8n webhooks                                  |
| 12  | **No cookies**                | No session cookies, no tracking cookies                                               | No cookie-related code in codebase; auth handled by Siteware platform                                             |
| 13  | **German UI language**        | All user-facing text in German                                                        | Button labels, toast messages, status badges — all German (e.g., "Genehmigung fehlgeschlagen")                    |

### Data Lifecycle

```
Email arrives → n8n classifies → POST to Express → SSE → Zustand store → User acts → Webhook to n8n
                                                                              │
                                                                              └→ Email removed from store
                                                                                 (approve, reject, retriage,
                                                                                  delete, dismiss)

No data persists beyond the browser session. Page reload = empty store (re-seeded by mock data or SSE).
```

### What Is NOT Stored

- No email bodies on disk or in any database
- No user session data
- No authentication tokens (Siteware platform handles auth)
- No browser history or navigation state
- No search indexes
- No cookies or localStorage items

---

## 9. Audit Logging System

### Architecture

```
User action in React
  │
  ├── emitAuditEvent() (src/lib/api/audit.ts)
  │     Fire-and-forget POST to /api/audit
  │     5-second timeout, silent failure
  │     Never blocks or affects UX
  │
  └── POST /api/audit (src/server/index.ts:123)
        │
        ├── validateAuditPayload() (src/server/audit.ts)
        │     Checks: action (enum), email_id (non-empty string), result (success/failure)
        │     Optional: category, error, context
        │
        └── writeAuditLog() (src/server/audit.ts)
              Writes JSON line to process.stdout
              Adds: audit: true, timestamp (ISO), source_ip
```

### Tracked Actions (10)

| Action                    | Trigger                                | View               |
| ------------------------- | -------------------------------------- | ------------------ |
| `draft_approved`          | User approves a draft reply            | Dringend, Sonstige |
| `draft_rejected`          | User rejects a draft reply             | Dringend, Sonstige |
| `email_retriaged`         | User moves spam/ad back to inbox       | Spam, Werbung      |
| `email_deleted`           | User deletes spam/ad emails            | Spam, Werbung      |
| `unsubscribe_requested`   | User triggers unsubscribe from ad view | Werbung            |
| `escalation_acknowledged` | User acknowledges escalation           | Eskalation         |
| `escalation_assigned`     | User assigns escalation to team        | Eskalation         |
| `escalation_dismissed`    | User dismisses acknowledged escalation | Eskalation         |
| `unsubscribe_retried`     | User retries failed unsubscribe        | Abmeldungen        |
| `email_ingested`          | Express receives valid email payload   | Server-side        |

### Audit Log Entry Format

```json
{
  "audit": true,
  "timestamp": "2026-03-03T10:15:30.000Z",
  "action": "draft_approved",
  "email_id": "draft-456",
  "category": "URGENT",
  "result": "success",
  "source_ip": "::1",
  "context": {
    "sender_email": "mueller@example.de",
    "subject": "Re: Vertragsverlängerung",
    "reply_language": "de"
  }
}
```

**Filtering:** All audit lines have `"audit": true` — use `jq 'select(.audit == true)'` or equivalent to filter audit entries from regular server output.

**Design principles:**

- Audit must never affect UX (fire-and-forget, silent failure)
- Every user action generates an audit event
- Every email ingestion generates an audit event
- Context is optional but includes relevant details (sender, subject, assigned_to, reason)

---

## 10. Environment Variables

| Variable                    | Required         | Default                 | Purpose                                                                                                                               |
| --------------------------- | ---------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_N8N_WEBHOOK_BASE_URL` | Yes (production) | —                       | Base URL for n8n webhook endpoints (e.g., `https://n8n.siteware.io`). Without this, all webhook calls throw `WebhookError`.           |
| `VITE_DASHBOARD_API_PORT`   | No               | `3002`                  | Port for the Express data ingestion server. Used by both `server/index.ts` and `vite.config.ts` (proxy target).                       |
| `VITE_USE_MOCK_DATA`        | No               | `true`                  | When `"true"` (default), seeds the Zustand store with mock data on load and disables SSE connection. Set to `"false"` for production. |
| `DASHBOARD_CORS_ORIGINS`    | No               | `http://localhost:5173` | Comma-separated list of allowed CORS origins for the Express server. Set to production domain in deployment.                          |

**Note:** Variables prefixed with `VITE_` are embedded into the client bundle at build time by Vite. `DASHBOARD_CORS_ORIGINS` is server-side only and not exposed to the client.

---

## 11. Build & Development

### Commands

| Command              | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `npm install`        | Install all dependencies                                  |
| `npm run dev`        | Start Vite dev server (port 5173) with HMR                |
| `npm run dev:server` | Start Express data ingestion server via `tsx` (port 3002) |
| `npm run build`      | Production build: `tsc -b && vite build`                  |
| `npm run preview`    | Preview production build locally                          |
| `npm run lint`       | Run ESLint                                                |
| `npx tsc --noEmit`   | Type check (frontend only, uses `tsconfig.app.json`)      |

### TypeScript Configuration

3 tsconfig files for different compilation targets:

| File                   | Target | Scope                           | Strict |
| ---------------------- | ------ | ------------------------------- | ------ |
| `tsconfig.app.json`    | ES2022 | `src/` (excludes `src/server/`) | Yes    |
| `tsconfig.node.json`   | ES2023 | `vite.config.ts` only           | Yes    |
| `tsconfig.server.json` | ES2022 | `src/server/` + `src/types/`    | Yes    |

All three share: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `moduleResolution: "bundler"`.

### Production Bundle

- **JS:** ~108KB gzipped (well under 200KB budget)
- **CSS:** ~7.5KB gzipped
- **Output:** `dist/` directory
- **Deployment:** Embedded in Siteware SiteFlow platform

### Path Aliases

`@/` maps to `./src/` — configured in both `tsconfig.app.json`, `tsconfig.server.json`, and `vite.config.ts`.

---

## 12. Known Limitations & Production Gaps

### Dashboard-Side Gaps

| Gap                                     | Current Behavior                                                                 | Production Requirement                                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Delete is local-only**                | "Ausgewaehlte loeschen" removes from Zustand store but does not delete from IMAP | Needs n8n delete webhook endpoint + IMAP delete node                                                                            |
| **Escalation assignment is local-only** | "Zuweisen" dropdown updates UI but does not notify the assigned person           | Needs n8n assignment webhook (email/SMS/platform notification)                                                                  |
| **Retriage sends minimal data**         | Dashboard sends only `email_id`, `sender_email`, `subject`, `original_category`  | n8n must look up full email body by `email_id` from its own storage for re-classification (dashboard only has 150-char preview) |
| **No offline/error recovery**           | If SSE disconnects, no queued emails are replayed                                | Consider adding last-event-id or polling fallback                                                                               |
| **No pagination**                       | All emails rendered in a single list                                             | 500-item cap prevents overflow, but large lists may impact UX                                                                   |

### n8n-Side Gaps (Not Dashboard Work)

| Mock                    | Current Behavior                        | Production Requirement                                    |
| ----------------------- | --------------------------------------- | --------------------------------------------------------- |
| **Send Email (SMTP)**   | Mock node logs but doesn't send         | Replace with `emailSend` node + real SMTP credentials     |
| **Auto-Archive**        | Mock node, no action                    | Replace with IMAP move command after approve/reject       |
| **SMS Notification**    | Mock node, no action                    | Replace with HTTP Request to Siteware SMS API             |
| **Attempt Unsubscribe** | Mock node, always returns "erfolgreich" | Replace with real HTTP GET (one-click) / mailto execution |
| **IMAP Trigger**        | Disabled, using test data               | Enable with real IMAP credentials during onboarding       |

---

## 13. Pre-Production Checklist

### Environment Configuration

- [ ] Set `VITE_N8N_WEBHOOK_BASE_URL` to production n8n instance URL
- [ ] Set `DASHBOARD_CORS_ORIGINS` to production Siteware SiteFlow domain
- [ ] Set `VITE_USE_MOCK_DATA=false` to disable mock data seeding
- [ ] Set `VITE_DASHBOARD_API_PORT` if different from 3002

### n8n Workflow Updates

- [ ] Enable real IMAP trigger with production mailbox credentials
- [ ] Replace SMTP mock with real `emailSend` node + SMTP credentials
- [ ] Replace unsubscribe mock with real HTTP GET (one-click) / mailto execution
- [ ] Replace auto-archive mock with IMAP move command
- [ ] Replace SMS notification mock with Siteware SMS API integration
- [ ] Add `/webhook/delete` endpoint for IMAP email deletion (Spam/Ad delete actions)
- [ ] Add `/webhook/assign` endpoint for escalation assignment notifications

### Infrastructure

- [ ] Set up log aggregation for Express stdout (filter audit lines with `"audit": true`)
- [ ] Configure reverse proxy / load balancer for Express server
- [ ] Verify Siteware SiteFlow embedding works with production CORS settings
- [ ] Set up health check monitoring on `GET /api/health`
- [ ] Run `npm run build` and verify production bundle deploys correctly

### Security

- [ ] Ensure `.env` file is not committed (verify `.gitignore`)
- [ ] Rotate any test webhook URLs or credentials
- [ ] Verify CORS whitelist contains only production origins
- [ ] Consider adding rate limiting to Express endpoints (not implemented in MVP)
- [ ] Consider adding authentication between n8n and Express (not implemented in MVP)

### Verification

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] All 6 category views render correctly with real data
- [ ] All 4 webhook calls succeed against production n8n
- [ ] SSE connection establishes and receives real email events
- [ ] Audit log entries appear in stdout for all user actions
