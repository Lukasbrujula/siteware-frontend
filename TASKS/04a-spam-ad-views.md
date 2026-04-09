# Task: 04a-spam-ad-views

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
- [x] Grep, Glob
- [ ] WebFetch
- [ ] Task (sub-agents)

### 3. Guardrails (DO NOT)

- [ ] Do NOT implement real webhook calls — use placeholder functions that log to console
- [ ] Do NOT auto-delete spam — user must explicitly select and confirm
- [ ] Do NOT execute real unsubscribe — just trigger the action (Task 06 wires the webhook)

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_System_Instructions.md` (section 5.2 — Spam and Werbung views), `docs/Siteware_Project_Status.md` (section 5 — payload shapes)

### 5. Memory

- [x] N/A

### 6. Success Criteria

- [ ] `SpamView` component: table with sender, subject, date, preview, confidence. Checkbox for batch select. "Delete Selected" and "Move to Inbox" (re-triage) buttons.
- [ ] `AdView` component: same as spam table + "Unsubscribe" button per row. Shows unsubscribe availability indicator.
- [ ] Both views read from Zustand store
- [ ] Row click expands to show full preview and classification reasoning
- [ ] Batch actions: select multiple → delete all / move all
- [ ] Low confidence flag shown visually (yellow warning icon)
- [ ] Empty state: "No spam detected" / "No advertisements" message
- [ ] Verification: `npx tsc --noEmit` exits 0

### 7. Dependencies

- [x] Task 02 (types)
- [x] Task 03 (layout with tabs)

### 8. Failure Handling

**Max attempts:** 3
**On failure:** Simplify — get basic table rendering first, add interactions second
**Rollback:** `git stash && git checkout HEAD~1`

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] shadcn Table needs custom cell rendering for badges/icons
- [ ] Batch selection pattern with Zustand needs specific approach

---

## Human Checkpoint

- [x] **NONE** — proceed automatically

---

## Description

Build the Spam and Werbung (Advertising) category views. These are read-only list views where users review AI classifications, delete confirmed spam/ads, move misclassified emails back for re-triage, or trigger unsubscribes.

## Steps

1. Create shared `src/components/email/EmailTable.tsx` — reusable table with checkbox, sender, subject, date, preview columns
2. Create `src/views/SpamView.tsx` — uses EmailTable, adds Delete and Move to Inbox actions
3. Create `src/views/AdView.tsx` — uses EmailTable, adds Unsubscribe button per row
4. Add row expansion for preview + reasoning
5. Add batch selection logic
6. Add mock data to store for both categories
7. Connect to tabs from Task 03

## On Completion

- **Commit:** `feat: spam and advertising views with batch actions`
- **Update:** CLAUDE.md
