# Task: 05-mock-data-server

## Status

- [x] Pending
- [ ] In Progress
- [ ] Verified
- [ ] Complete

## Pillars

### 1. Model

sonnet

### 2. Tools Required

- [x] Read, Write, Edit (file operations)
- [x] Bash: `npx tsc --noEmit`
- [ ] Grep, Glob
- [ ] WebFetch
- [ ] Task (sub-agents)

### 3. Guardrails (DO NOT)

- [ ] Do NOT add a real backend — just a mock data seeder and optional Express mock server
- [ ] Do NOT create more than 5 mock items per category — enough to test, not enough to clutter

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_Project_Status.md` (section 5 — all payload shapes)

### 5. Memory

- [x] N/A

### 6. Success Criteria

- [ ] `src/lib/mock-data.ts` — realistic mock data for all 6 categories (German and English examples)
- [ ] Mock data matches exact payload shapes from n8n
- [ ] Includes edge cases: low confidence triage, emails with placeholders, failed unsubscribes, legal threat escalation
- [ ] Store initializer loads mock data on app start (dev mode only)
- [ ] Optional: simple Express server (`src/mock-server.ts`) that accepts the n8n webhook payloads and pushes to the store via SSE or polling
- [ ] Verification: all views render correctly with mock data

### 7. Dependencies

- [x] Task 02 (types)
- [x] Task 04a-d (all views built)

### 8. Failure Handling

**Max attempts:** 2
**On failure:** Skip the Express mock server, just use inline store seeding
**Rollback:** `git stash && git checkout HEAD~1`

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] SSE from mock server to React needs specific setup

---

## Human Checkpoint

- [x] **NONE** — proceed automatically

---

## Description

Create realistic mock data for all email categories and optionally a mock server that simulates n8n pushing data. This enables full end-to-end UI testing without the real n8n workflow.

## Mock Data Scenarios

- **Spam:** lottery scam, fake invoice, phishing link (all high confidence)
- **Ad:** HubSpot newsletter (with unsubscribe link), product announcement (no unsubscribe)
- **Urgent:** Andreas contract renewal (German, high urgency, with placeholders), client deadline (English)
- **Other:** meeting confirmation (English), general inquiry (German)
- **Escalation:** angry customer with legal threat (German), high churn risk complaint
- **Unsubscribe:** one successful (one-click), one failed (no link found)

## Steps

1. Create `src/lib/mock-data.ts` with typed mock objects
2. Create `src/lib/seed-store.ts` — function to populate Zustand store with mock data
3. Call seeder in App.tsx (dev mode check)
4. Optionally create `src/mock-server.ts` for external data push simulation
5. Verify all views render correctly with mock data

## On Completion

- **Commit:** `feat: mock data and store seeder for all email categories`
- **Update:** CLAUDE.md
