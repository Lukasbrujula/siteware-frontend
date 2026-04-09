# Task: 07-data-ingestion

## Status

- [x] Pending
- [x] In Progress
- [x] Verified
- [x] Complete

## Pillars

### 1. Model

opus

### 2. Tools Required

- [x] Read, Write, Edit (file operations)
- [x] Bash: `npx tsc --noEmit`, `node src/server.ts`
- [x] Grep, Glob
- [ ] WebFetch
- [ ] Task (sub-agents)

### 3. Guardrails (DO NOT)

- [ ] Do NOT add a database — keep data in memory (Zustand store on client, or simple in-memory array on server)
- [ ] Do NOT add authentication to the ingestion API — n8n calls are trusted (internal network)
- [ ] Do NOT accept payloads that don't match the expected schema — validate and reject

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_Project_Status.md` (section 5 — all payload shapes from n8n)

### 5. Memory

- [x] N/A

### 6. Success Criteria

- [x] Dashboard can receive data from n8n (n8n HTTP Request nodes POST to dashboard endpoints)
- [x] Approach decided: Express server with SSE push to React client
- [x] Endpoints for each category: POST /api/email/spam, /api/email/ad, /api/email/draft, /api/email/escalation, /api/email/unsubscribe
- [x] Payload validation against TypeScript interfaces (reject malformed data)
- [x] New data appears in dashboard in real-time via SSE
- [x] n8n mock Code nodes can be replaced with HTTP Request nodes pointing to these endpoints
- [x] Verification: `npx tsc --noEmit` exits 0

### 7. Dependencies

- [x] Task 02 (types — used for validation)
- [x] Task 06 (webhook integration — bidirectional communication now complete)

### 8. Failure Handling

**Max attempts:** 3
**On failure:** Fall back to simplest approach: polling endpoint that returns all pending items
**Rollback:** `git stash && git checkout HEAD~1`

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] SSE vs WebSocket vs polling — which approach works best for this use case
- [ ] CORS configuration needed for n8n → dashboard communication

---

## Human Checkpoint

- [ ] **PAUSE** — discuss with team: which data ingestion pattern to use (SSE vs polling vs WebSocket)

---

## Description

Build the data ingestion layer so n8n can push classified emails to the dashboard in real-time. This replaces the mock Code nodes in the n8n workflow with real HTTP Request nodes that POST to the dashboard API.

## Architecture Options

1. **Express + SSE (recommended):** Small Express server alongside Vite dev server. n8n POSTs data to Express. Express pushes to React via Server-Sent Events. Simplest real-time option.
2. **Polling:** React polls a REST endpoint every 5s. Simpler but not real-time.
3. **WebSocket:** Full duplex. Overkill for this use case.

## Steps

1. Decide architecture (likely Express + SSE)
2. Create `src/server/index.ts` — Express server with category endpoints
3. Add payload validation middleware
4. Add SSE endpoint for React client to subscribe
5. Create `src/hooks/useDataStream.ts` — React hook that connects to SSE and updates Zustand store
6. Test: POST mock payload to Express → appears in dashboard
7. Document the endpoint URLs for n8n workflow update

## On Completion

- **Commit:** `feat: data ingestion API with real-time push to dashboard`
- **Update:** CLAUDE.md, `docs/Siteware_Project_Status.md` (update n8n mock nodes with real endpoints)
- **Handoff notes:** n8n mock Code nodes (Spam → Dashboard, Ad → Dashboard, etc.) can now be replaced with HTTP Request nodes pointing to these endpoints.
