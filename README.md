# Siteware Email Automation Dashboard

Human-in-the-loop dashboard for Siteware's AI-powered email automation system. Embedded in the SiteFlow platform, it lets users review, approve, reject, and retriage emails classified by n8n workflows.

## Tech Stack

- **React 19** + **TypeScript** (strict) — Vite SPA
- **Tailwind CSS v4** + **shadcn/ui** — UI components
- **Zustand** — In-memory state management
- **Express** — Data ingestion server with SSE push
- **Native fetch** — Webhook calls to n8n

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+

### Setup

```bash
# Install dependencies
npm install

# Create .env from example values
cp .env .env.local   # optional, .env already has dev defaults

# Start frontend dev server (port 5173)
npm run dev

# In another terminal: start data ingestion server (port 3002)
npm run dev:server
```

The frontend proxies `/api/*` and `/events` to the Express server via Vite config.

### Environment Variables

| Variable                    | Default                 | Description                                           |
| --------------------------- | ----------------------- | ----------------------------------------------------- |
| `VITE_N8N_WEBHOOK_BASE_URL` | —                       | n8n webhook base URL (e.g. `https://n8n.siteware.io`) |
| `VITE_DASHBOARD_API_PORT`   | `3002`                  | Express data ingestion server port                    |
| `VITE_USE_MOCK_DATA`        | `true`                  | Set to `"false"` to disable mock data seeding         |
| `DASHBOARD_CORS_ORIGINS`    | `http://localhost:5173` | Comma-separated allowed CORS origins                  |

### Commands

```bash
npm run dev          # Vite dev server (frontend)
npm run dev:server   # Express data ingestion server
npm run build        # Production build (tsc -b + vite build)
npm run preview      # Preview production build
npx tsc --noEmit     # Type check (frontend only)
```

## Architecture

```
┌─────────────┐       POST /api/email/:category       ┌──────────────────┐
│   n8n        │ ────────────────────────────────────► │  Express Server  │
│  Workflows   │                                       │  (port 3002)     │
└─────────────┘                                        │                  │
                                                       │  Validates       │
                                                       │  payload, then   │
                                                       │  broadcasts via  │
                                                       │  SSE             │
                                                       └───────┬──────────┘
                                                               │ SSE /events
                                                               ▼
                                                       ┌──────────────────┐
                                                       │  React SPA       │
                                                       │  (Vite, port     │
                                                       │   5173)          │
                                                       │                  │
                                                       │  useDataStream() │
                                                       │  → Zustand store │
                                                       └───────┬──────────┘
                                                               │ POST /webhook/*
                                                               ▼
                                                       ┌──────────────────┐
                                                       │  n8n Webhooks    │
                                                       │  (approve,       │
                                                       │   reject, etc.)  │
                                                       └──────────────────┘
```

**Data flow:**

1. n8n classifies incoming emails and POSTs them to the Express server
2. Express validates payloads and broadcasts via Server-Sent Events (SSE)
3. React SPA receives events, stores in Zustand (in-memory, no persistence)
4. User actions (approve, reject, retriage, unsubscribe) POST back to n8n webhooks

## n8n Integration

### Data Ingestion (n8n → Dashboard)

POST JSON payloads to the Express server. All endpoints validate payloads and return `422` with error details on invalid data.

| Category             | Endpoint                      | Payload Type                                 |
| -------------------- | ----------------------------- | -------------------------------------------- |
| Spam                 | `POST /api/email/spam`        | SpamAdEmail (`category: "SPAM"`)             |
| Advertising          | `POST /api/email/ad`          | SpamAdEmail (`category: "AD"`)               |
| Draft (Urgent/Other) | `POST /api/email/draft`       | DraftEmail (`category: "URGENT" \| "OTHER"`) |
| Escalation           | `POST /api/email/escalation`  | EscalationAlert (`category: "ESCALATION"`)   |
| Unsubscribe Status   | `POST /api/email/unsubscribe` | UnsubscribeStatus                            |

**Example: Spam email**

```json
{
  "workflow": "email_inbox",
  "category": "SPAM",
  "email_id": "unique-id-123",
  "sender_name": "Prize Center",
  "sender_email": "winner@spam.xyz",
  "sender_domain": "spam.xyz",
  "subject": "Sie haben gewonnen!",
  "preview": "Herzlichen Glückwunsch...",
  "date": "2026-03-01T09:15:00Z",
  "confidence": 0.98,
  "low_confidence": false,
  "reasoning": "Typische Gewinnspiel-Spam-Merkmale",
  "list_unsubscribe_url": null,
  "list_unsubscribe_mailto": null,
  "unsubscribe_available": false
}
```

**Example: Draft email**

```json
{
  "workflow": "email_inbox",
  "category": "URGENT",
  "email_id": "draft-456",
  "sender_name": "Thomas Müller",
  "sender_email": "mueller@example.de",
  "subject": "Re: Vertragsverlängerung",
  "original_subject": "Vertragsverlängerung",
  "original_preview": "Die Frist läuft ab...",
  "draft_html": "<p>Sehr geehrter Herr Müller...</p>",
  "draft_plain": "Sehr geehrter Herr Müller...",
  "placeholders": ["BITTE ERGÄNZEN: Datum"],
  "reply_language": "de",
  "confidence": 0.82,
  "review_reason": "Fehlende Terminangabe",
  "requires_human_review": true,
  "low_confidence": false,
  "is_escalated": false,
  "sentiment_score": -0.1,
  "date": "2026-03-01T14:30:00Z",
  "timestamp": "2026-03-01T14:30:00Z"
}
```

**Health check:** `GET /api/health` returns `{ "status": "ok", "clients": <number> }`

### Dashboard Actions (Dashboard → n8n)

The dashboard calls n8n webhook endpoints when users take actions. Configure `VITE_N8N_WEBHOOK_BASE_URL` to point at your n8n instance.

| Action        | Endpoint                      | Payload                                                                       |
| ------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| Approve Draft | `POST /webhook/approve-draft` | `{ email_id, draft_html, draft_plain, sender_email, subject }`                |
| Reject Draft  | `POST /webhook/reject-draft`  | `{ email_id, reason? }`                                                       |
| Re-Triage     | `POST /webhook/retriage`      | `{ email_id, sender_email, subject, original_category }`                      |
| Unsubscribe   | `POST /webhook/unsubscribe`   | `{ email_id, sender_email, list_unsubscribe_url?, list_unsubscribe_mailto? }` |

All webhook calls include a 15-second timeout via `AbortSignal.timeout()`.

## Folder Structure

```
src/
├── components/
│   ├── ui/               # shadcn/ui primitives (Button, Card, Badge, etc.)
│   ├── layout/           # DashboardHeader, CategoryTabs
│   └── email/            # EmailTable, DraftEditor, DraftList, OriginalEmail,
│                         # SentimentBadge, RiskFlags, UnsubscribeTable,
│                         # UnsubscribeStatusBadge, UnsubscribeMethodBadge
├── views/                # One view per category tab
│   ├── SpamView.tsx      # Spam emails with delete/retriage
│   ├── AdView.tsx        # Ads with unsubscribe/retriage
│   ├── UrgentView.tsx    # Urgent drafts for review
│   ├── OtherView.tsx     # Other drafts for review
│   ├── DraftReviewView.tsx  # Shared draft review layout (used by Urgent/Other)
│   ├── EscalationView.tsx   # Escalation alerts with severity sorting
│   └── UnsubscribeView.tsx  # Unsubscribe status tracking
├── hooks/
│   └── useDataStream.ts  # SSE connection hook
├── lib/
│   ├── api/webhooks.ts   # n8n webhook API client
│   ├── store/
│   │   ├── email-store.ts  # Zustand store (all email data)
│   │   └── ui-store.ts     # UI state (active tab, selection)
│   ├── mock-data.ts      # Mock data for all categories
│   └── seed-store.ts     # Seeds store with mock data
├── types/
│   ├── email.ts          # Email type definitions
│   └── webhook.ts        # Webhook request/response types
├── server/               # Express data ingestion server
│   ├── index.ts          # Routes, CORS, SSE endpoint
│   ├── sse.ts            # SSE client manager with heartbeat
│   └── validation.ts     # Runtime payload validation
├── App.tsx               # Root component
└── main.tsx              # Entry point
```

## Six Category Views

| Tab         | German Label | Actions                                    |
| ----------- | ------------ | ------------------------------------------ |
| Spam        | Spam         | Delete selected, Move to Inbox (re-triage) |
| Advertising | Werbung      | Unsubscribe, Move to Inbox (re-triage)     |
| Urgent      | Dringend     | Edit draft, Approve & Send, Reject         |
| Other       | Sonstige     | Edit draft, Approve & Send, Reject         |
| Escalation  | Eskalation   | Acknowledge, Assign, Dismiss               |
| Unsubscribe | Abmeldungen  | Retry failed                               |

## Key Features

- **Placeholder highlighting** — `[BITTE ERGÄNZEN: ...]` markers in drafts are highlighted yellow; approve button is disabled until all placeholders are filled
- **Confidence badges** — Color-coded confidence scores (green >80%, yellow 50-80%, red <50%) with low-confidence warnings
- **Batch actions** — Select multiple emails for bulk delete or retriage
- **Real-time updates** — SSE push from Express server, auto-reconnect
- **Loading states** — All async actions show spinners and disable buttons
- **Empty states** — All categories show a meaningful empty state
- **German UI** — All user-facing labels in German; code and comments in English

## Compliance

- DSGVO/GDPR compliant — no external analytics, no CDN fonts, no third-party scripts
- In-memory only — no localStorage, no cookies for email data
- All processing on Siteware Frankfurt infrastructure
- Payload validation on server side (input sanitization, HTML injection prevention)

## Production Build

```bash
npm run build   # tsc -b && vite build
```

Output goes to `dist/`. The SPA is designed to be embedded in the Siteware SiteFlow platform.
