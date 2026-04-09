# Task: 02-types-and-store

## Status

- [ ] Pending
- [ ] In Progress
- [x] Verified
- [x] Complete

## Pillars

### 1. Model

sonnet

### 2. Tools Required

- [x] Read, Write, Edit (file operations)
- [x] Bash: `npx tsc --noEmit`
- [x] Grep, Glob (search)
- [ ] WebFetch
- [ ] Task (sub-agents)

### 3. Guardrails (DO NOT)

- [ ] Do NOT add API calls yet — just types and store structure
- [ ] Do NOT add persistence (localStorage) to Zustand — data is ephemeral from webhooks
- [ ] Do NOT create components — types and state only

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_Project_Status.md` (section 5 — all payload shapes), `docs/Siteware_System_Instructions.md` (section 5 — dashboard data contracts)

### 5. Memory

- [x] N/A

### 6. Success Criteria

- [ ] `src/types/email.ts` — interfaces for all email payloads: SpamEmail, AdEmail, UrgentDraft, OtherDraft, EscalationAlert, UnsubscribeStatus
- [ ] `src/types/webhook.ts` — interfaces for webhook request/response bodies (approve, reject, retriage, unsubscribe)
- [ ] `src/lib/store/email-store.ts` — Zustand store with slices for each category (spam[], ads[], urgent[], other[], escalations[], unsubscribes[])
- [ ] Store actions: addEmail, removeEmail, updateEmail, clearCategory, getActionCount (aggregated badge count)
- [ ] `src/lib/store/ui-store.ts` — UI state: activeTab, selectedEmailId, draftEditorContent
- [ ] All types match the exact payload shapes from n8n (reference the docs)
- [ ] Verification: `npx tsc --noEmit` exits 0

### 7. Dependencies

- [x] Task 01 must be complete

### 8. Failure Handling

**Max attempts:** 3
**On failure:** Check payload shapes against docs, fix type mismatches
**Rollback:** `git stash && git checkout HEAD~1`

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] Payload shapes from n8n differ from what's documented — note discrepancies

---

## Human Checkpoint

- [x] **NONE** — proceed automatically

---

## Description

Define all TypeScript interfaces for the data flowing between n8n and the dashboard, and create the Zustand stores that will hold this data in memory.

## Steps

1. Read `docs/Siteware_Project_Status.md` section 5 — extract every field from every payload
2. Create `src/types/email.ts` with interfaces for each email category
3. Create `src/types/webhook.ts` with request/response types for each webhook
4. Create `src/lib/store/email-store.ts` — one Zustand store for all email data
5. Create `src/lib/store/ui-store.ts` — UI state (active tab, selections, editor state)
6. Add computed selectors: `getActionCount()` returns total pending actions for the red badge
7. Verify types compile

## On Completion

- **Commit:** `feat: add TypeScript types and Zustand stores for email data`
- **Update:** CLAUDE.md with type file locations
