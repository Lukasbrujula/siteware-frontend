# Task: 04d-unsubscribe-view

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

- [ ] Do NOT execute real unsubscribe requests — just display status
- [ ] Do NOT remove entries from the list — keep full history

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_System_Instructions.md` (section 4 — Unsubscribe Bot, section 5.2 — Unsubscribe view), `docs/Siteware_Project_Status.md` (section 5 — unsubscribe payload)

### 5. Memory

- [x] N/A

### 6. Success Criteria

- [ ] `UnsubscribeView` — table showing unsubscribe attempts
- [ ] Columns: sender, method used (one-click/mailto/not-found), status (erfolgreich/nicht erfolgreich), reason, timestamp
- [ ] Status column color-coded: green for erfolgreich, red for nicht erfolgreich
- [ ] "Retry" button on failed entries
- [ ] Empty state message
- [ ] Verification: `npx tsc --noEmit` exits 0

### 7. Dependencies

- [x] Task 02 (types — UnsubscribeStatus interface)
- [x] Task 03 (layout with tabs)

### 8. Failure Handling

**Max attempts:** 3
**Rollback:** `git stash && git checkout HEAD~1`

### 9. Learning

- [x] N/A — straightforward table view

---

## Human Checkpoint

- [x] **NONE** — proceed automatically

---

## Description

Build the unsubscribe status tracking view. Shows results of unsubscribe attempts with status and retry option for failures.

## Steps

1. Create `src/views/UnsubscribeView.tsx` — status table
2. Add status badges (erfolgreich = green, nicht erfolgreich = red)
3. Add retry button for failed entries
4. Add mock data
5. Connect to tab

## On Completion

- **Commit:** `feat: unsubscribe status view with retry`
- **Update:** CLAUDE.md
