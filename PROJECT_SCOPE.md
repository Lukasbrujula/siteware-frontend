# Project Scope: Siteware Email Inbox Automation Dashboard

## Vision

Siteware's AI email automation system (powered by n8n + Claude) classifies incoming emails, drafts replies, and detects escalations automatically. But humans need to stay in the loop: reviewing AI-drafted replies, filling in missing information, approving or rejecting before anything gets sent. This dashboard is that human layer — embedded directly in Siteware's SiteFlow platform.

## Goals

- [x] Scaffold React SPA with Vite + TypeScript + Tailwind v4 + shadcn/ui
- [ ] Type-safe data contracts matching all n8n payload shapes
- [ ] Six category views: Spam, Werbung, Urgent, Other, Escalation, Unsubscribe
- [ ] Draft review with inline editing and placeholder highlighting
- [ ] Action counter (red badge) aggregating all pending items
- [ ] All user actions wired to n8n webhook endpoints
- [ ] Real-time data ingestion from n8n
- [ ] Production build passes, responsive at 1024px+

## Non-Goals (Explicitly Out of Scope)

- User authentication (handled by Siteware platform)
- Database / persistence layer (data is ephemeral from webhooks)
- Email sending (n8n handles SMTP)
- AI classification logic (n8n + Siteware API handles this)
- Mobile-first design (desktop dashboard, 1024px minimum)
- Multi-language i18n framework (hardcoded German labels, English code)
- Notification system beyond the action counter badge

## Success Criteria

- [ ] All 6 category views render with correct data
- [ ] Draft editor highlights `[BITTE ERGÄNZEN: ...]` placeholders in yellow
- [ ] Approve button disabled when placeholders remain unfilled
- [ ] All 4 webhook actions (approve, reject, retriage, unsubscribe) fire correctly
- [ ] n8n can push data to dashboard and it appears in real-time
- [ ] `npm run build` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] No external resource requests (DSGVO compliant)
- [ ] Responsive at 1024px, 1280px, 1440px, 1920px

## Phases

### Phase 1: Foundation

**Status:** Not Started
**Tasks:** 01-project-scaffold, 02-types-and-store

### Phase 2: UI Shell

**Status:** Not Started
**Tasks:** 03-dashboard-layout

### Phase 3: Category Views

**Status:** Not Started
**Tasks:** 04a-spam-ad-views, 04b-draft-review-views, 04c-escalation-view, 04d-unsubscribe-view, 05-mock-data

### Phase 4: Integration

**Status:** Not Started
**Tasks:** 06-webhook-integration, 07-data-ingestion

### Phase 5: Polish & Ship

**Status:** Not Started
**Tasks:** 08-polish-and-test

### Phase 6: Multi-Tenant Infrastructure

**Status:** In Progress
**Tasks:** TASK_01_imap_poller (complete), TASK_02 (pending)

#### IMAP Poller Service (Task 01) — Complete

- `scripts/poller.js` — Continuous polling loop (5-min interval)
- `scripts/lib/db-client.js` — Turso client for tenant queries
- `scripts/lib/imap-client.js` — imapflow wrapper (UNSEEN fetch, mark SEEN)
- `railway.json` — Railway deployment config
- All credentials via environment variables (never in code)
- Per-tenant isolation: one tenant failing does not stop others

## Risks & Mitigations

| Risk                           | Impact | Likelihood | Mitigation                                                            |
| ------------------------------ | ------ | ---------- | --------------------------------------------------------------------- |
| n8n webhook URLs not finalized | High   | Medium     | Build with configurable env var, test with mock server                |
| Payload shape mismatch         | High   | Medium     | Types derived directly from Project Status doc, validate at ingestion |
| Real-time push complexity      | Medium | Medium     | Start with SSE (simplest), fall back to polling if needed             |
| SiteFlow embedding constraints | Medium | Low        | Build as standalone SPA first, adapt for embedding later              |
| Tailwind v4 breaking changes   | Low    | Medium     | Pin versions, use `@theme inline` pattern                             |
| shadcn/ui component gaps       | Low    | Low        | Extend with custom components as needed                               |

## Dependencies

- [x] n8n workflow engine running (Lane 1 DONE, Lanes 2-5 MOCK)
- [ ] N8N_WEBHOOK_BASE_URL confirmed
- [ ] TRIAGE_AGENT_ID from Siteware (for n8n, not dashboard)
- [ ] REPLY_COMPOSER_AGENT_ID from Siteware (for n8n, not dashboard)
- [ ] Production base URL from Andreas
- [ ] Data ingestion pattern decision (SSE vs polling)

## Human Checkpoints

- [ ] **Task 04b** — Pause after draft editor working, verify placeholder highlighting
- [ ] **Task 06** — Pause before first real webhook test, verify n8n URLs
- [ ] **Task 07** — Pause to discuss data ingestion architecture (SSE vs polling vs WebSocket)
- [ ] **Task 08** — Final review before declaring MVP complete

## Recommended Agents

| Agent                | Use For                                     |
| -------------------- | ------------------------------------------- |
| planner              | All task breakdowns and `/plan` expansions  |
| architect            | Data ingestion pattern decision (Task 07)   |
| tdd-guide            | Component tests, webhook integration tests  |
| code-reviewer        | After every task completion                 |
| ui-reviewer          | After UI components built (Tasks 03, 04a-d) |
| security-reviewer    | Before webhook integration (Task 06)        |
| build-error-resolver | Vite/TypeScript build failures              |
