# Project: Siteware Email Inbox Automation Dashboard

## What This Is

A React SPA dashboard embedded in the Siteware.io SiteFlow platform. It's the human-in-the-loop interface for an AI-powered email automation system. n8n classifies incoming emails, drafts replies, detects escalations, and pushes everything to this dashboard. Users review, approve, reject, or retriage.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** React 18+ with Vite (SPA, NOT Next.js)
- **Database:** None (data comes from n8n webhooks, stored in-memory via Zustand)
- **Auth:** None (Siteware platform handles auth externally)
- **Hosting:** Embedded in SiteFlow (Siteware.io platform)
- **Key Libraries:**
  - TypeScript (strict mode)
  - Tailwind CSS v4
  - shadcn/ui (Button, Card, Badge, Tabs, Table, Dialog, Textarea, Sonner)
  - Zustand (state management)
  - Native fetch (no axios)

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (frontend)
npm run dev:server   # Start Express data ingestion server
npm run build        # Production build
npm run preview      # Preview production build
npx tsc --noEmit     # Type check
```

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── ui/           # shadcn/ui primitives
│   ├── EmailTable.tsx
│   ├── DraftEditor.tsx
│   ├── SentimentBadge.tsx
│   ├── RiskFlags.tsx
│   └── DashboardHeader.tsx
├── views/            # Category view pages
│   ├── SpamView.tsx
│   ├── AdView.tsx
│   ├── UrgentView.tsx
│   ├── OtherView.tsx
│   ├── EscalationView.tsx
│   └── UnsubscribeView.tsx
├── hooks/            # Custom React hooks
│   └── useDataStream.ts
├── lib/              # Business logic
│   ├── api/
│   │   └── webhooks.ts
│   ├── store/
│   │   ├── email-store.ts
│   │   └── ui-store.ts
│   ├── mock-data.ts
│   └── seed-store.ts
├── types/            # TypeScript type definitions
│   ├── email.ts
│   └── webhook.ts
├── server/           # Express data ingestion server
│   ├── index.ts      # Express app, routes, SSE endpoint
│   ├── sse.ts        # SSE client manager with heartbeat
│   └── validation.ts # Runtime payload validation
├── App.tsx
└── main.tsx
docs/                 # Project documentation (read-only reference)
├── Siteware_Knowledge_Base.md
├── Siteware_System_Instructions.md
├── Siteware_Project_Status.md
└── Siteware_API_Reference.md
TASKS/                # Atomic task files (9-pillar format)
```

## Key Files

- `docs/Siteware_System_Instructions.md` — Section 5 defines dashboard data contracts
- `docs/Siteware_Project_Status.md` — Exact JSON payload shapes for every category
- `src/types/email.ts` — All TypeScript interfaces matching n8n payloads
- `src/lib/store/email-store.ts` — Central Zustand store
- `src/lib/api/webhooks.ts` — All n8n webhook integrations

## Environment Variables

```bash
# Required - NEVER commit actual values
VITE_N8N_WEBHOOK_BASE_URL=       # n8n webhook base URL (e.g. https://n8n.siteware.io)
VITE_DASHBOARD_API_PORT=3002     # Express data ingestion server port
VITE_USE_MOCK_DATA=true          # Set to "false" to disable mock data seeding
DASHBOARD_CORS_ORIGINS=http://localhost:5173  # Comma-separated allowed CORS origins
```

## n8n Webhook Endpoints (Dashboard → n8n)

| Action        | Method | Endpoint               | Trigger                          |
| ------------- | ------ | ---------------------- | -------------------------------- |
| Approve Draft | POST   | /webhook/approve-draft | User approves email draft        |
| Reject Draft  | POST   | /webhook/reject-draft  | User rejects email draft         |
| Re-Triage     | POST   | /webhook/retriage      | User moves spam/ad back to inbox |
| Unsubscribe   | POST   | /webhook/unsubscribe   | User triggers unsubscribe        |

## Data Ingestion Endpoints (n8n → Dashboard)

| Category             | Method | Endpoint               |
| -------------------- | ------ | ---------------------- |
| Spam                 | POST   | /api/email/spam        |
| Advertising          | POST   | /api/email/ad          |
| Draft (Urgent/Other) | POST   | /api/email/draft       |
| Escalation           | POST   | /api/email/escalation  |
| Unsubscribe Status   | POST   | /api/email/unsubscribe |

## Compliance

- [x] DSGVO/GDPR — Mandatory (German company, German users)
- [x] No external analytics (no Google Analytics, no Mixpanel)
- [x] No third-party data leaks (no CDN fonts, no external scripts)
- [x] No data persistence (in-memory only, no localStorage for email content)
- [x] All processing on Frankfurt servers (Siteware infrastructure)

## Language

- UI labels, tab names, status messages, button text: **German** where user-facing
- Code, comments, variable names: **English**
- Mixed content (emails): respect detected language from triage

## Six Category Views

| Tab         | German Label | Key Actions                            |
| ----------- | ------------ | -------------------------------------- |
| Spam        | Spam         | Delete, Move to Inbox (re-triage)      |
| Advertising | Werbung      | Unsubscribe, Move to Inbox (re-triage) |
| Urgent      | Dringend     | Edit draft, Approve & Send, Reject     |
| Other       | Sonstige     | Edit draft, Approve & Send, Reject     |
| Escalation  | Eskalation   | Acknowledge, Assign                    |
| Unsubscribe | Abmeldungen  | Retry failed                           |

## Current Phase

MVP Complete (Tasks 01-08 complete). Gap analysis vs Funktionsbeschreibung completed.

## Known Limitations (Gap Analysis)

### Dashboard-Side

- **Delete is local-only** — "Ausgewählte löschen" in Spam/Ad views removes from Zustand store but does not delete from IMAP. Needs n8n delete webhook + IMAP delete node for production.
- **Escalation assignment is local-only** — "Zuweisen" dropdown updates UI but does not notify the assigned person. Needs n8n assignment webhook for production.
- **Retriage sends minimal data** — Dashboard only has 150-char `preview`, not full `body_plain`. n8n must look up full email body by `email_id` from its own storage for re-classification.

### n8n-Side (Not Dashboard Work)

- **Send Email (SMTP)** — Mock node, logs but doesn't send. Replace with `emailSend` node + SMTP credentials.
- **Auto-Archive** — Mock node. Replace with IMAP move command.
- **SMS Notification** — Mock node. Replace with HTTP Request to Siteware SMS API.
- **Attempt Unsubscribe** — Mock node, always returns "erfolgreich". Replace with real HTTP GET / mailto.
- **IMAP Trigger** — Disabled, using test data. Enable with real IMAP credentials during onboarding.

## Project-Specific Rules

1. **No database** — All data is ephemeral from n8n webhooks
2. **No auth** — Siteware platform handles authentication
3. **No Next.js** — This is a Vite SPA, not an SSR app
4. **No axios** — Use native fetch
5. **Immutable state** — Zustand with immutable update patterns
6. **German UI labels** — User-facing text in German
7. **Placeholder highlighting** — `[BITTE ERGÄNZEN: ...]` must be yellow-highlighted in draft editor
8. **Approve disabled with placeholders** — Cannot send drafts with unfilled placeholders
9. **Auto-archive** — Remove emails from store after successful approve/reject
10. **DSGVO first** — No external resources, no analytics, no data leakage

## Recommended Agents

- **planner** — Task breakdowns, implementation strategy
- **architect** — Data ingestion pattern decision (SSE vs polling)
- **tdd-guide** — Component testing, webhook integration tests
- **code-reviewer** — After each task completion
- **ui-reviewer** — After UI components are built
- **security-reviewer** — Before any webhook integration
- **build-error-resolver** — When Vite/TypeScript build fails
