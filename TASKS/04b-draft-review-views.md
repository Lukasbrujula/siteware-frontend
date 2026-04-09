# Task: 04b-draft-review-views

## Status

- [x] Pending
- [ ] In Progress
- [ ] Verified
- [ ] Complete

## Pillars

### 1. Model

opus

### 2. Tools Required

- [x] Read, Write, Edit (file operations)
- [x] Bash: `npx tsc --noEmit`
- [x] Grep, Glob
- [ ] WebFetch
- [ ] Task (sub-agents)

### 3. Guardrails (DO NOT)

- [ ] Do NOT implement real SMTP send — Approve button triggers a placeholder function
- [ ] Do NOT allow sending if `[BITTE ERGÄNZEN]` placeholders are still present — block with warning
- [ ] Do NOT modify the original email content — only the AI draft is editable
- [ ] Do NOT auto-approve — human-in-the-loop is mandatory

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_System_Instructions.md` (section 2 — Reply Composer rules, section 5.2 — Urgent/Other views), `docs/Siteware_Project_Status.md` (section 5 — draft payload shape)

### 5. Memory

- [x] N/A

### 6. Success Criteria

- [ ] `DraftReviewView` component shared between Urgent and Other tabs
- [ ] Left panel: list of emails with drafts pending review (sender, subject, date, confidence, escalation flag)
- [ ] Right panel: selected email's original message + AI draft below
- [ ] AI draft displayed in editable rich-text area (or Textarea for MVP)
- [ ] `[BITTE ERGÄNZEN: ...]` placeholders highlighted in yellow with tooltip
- [ ] "Approve & Send" button — disabled if placeholders remain unfilled
- [ ] "Reject" button — opens confirmation dialog, optionally takes a reason
- [ ] Escalation indicator: red border/badge on escalated items
- [ ] Confidence display: color-coded (green >0.8, yellow 0.5-0.8, red <0.5)
- [ ] Review reason shown below the draft
- [ ] Verification: `npx tsc --noEmit` exits 0

### 7. Dependencies

- [x] Task 02 (types — UrgentDraft, OtherDraft interfaces)
- [x] Task 03 (layout with tabs)

### 8. Failure Handling

**Max attempts:** 3
**On failure:** Drop rich-text editor, use plain Textarea. Placeholder highlighting can be CSS-only.
**Rollback:** `git stash && git checkout HEAD~1`

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] Rich text editing in React is complex — note which library works best (or if Textarea is sufficient)
- [ ] Placeholder regex detection needs specific pattern for `[BITTE ERGÄNZEN: ...]`

---

## Human Checkpoint

- [ ] **PAUSE** after draft editor is working — verify placeholder highlighting looks correct before proceeding

---

## Description

Build the draft review interface for URGENT and OTHER emails. This is the core human-in-the-loop feature: users see the original email, the AI-generated draft reply, can edit the draft, fill in placeholders, and approve or reject.

## Steps

1. Create `src/components/email/DraftList.tsx` — list of emails with pending drafts
2. Create `src/components/email/OriginalEmail.tsx` — displays the original incoming email
3. Create `src/components/email/DraftEditor.tsx` — editable draft area with placeholder highlighting
4. Create `src/views/DraftReviewView.tsx` — composes list + original + editor in split layout
5. Add placeholder detection: regex for `[BITTE ERGÄNZEN: ...]`, highlight in yellow
6. Add Approve button with placeholder guard (disabled if unfilled placeholders exist)
7. Add Reject button with confirmation dialog
8. Wire both Urgent and Other tabs to use DraftReviewView with different store slices
9. Add mock draft data to store
10. Test the full review flow: select email → read original → edit draft → approve/reject

## On Completion

- **Commit:** `feat: draft review views with placeholder highlighting and approve/reject`
- **Update:** CLAUDE.md
- **Handoff notes:** Approve/Reject buttons call placeholder functions. Task 06 wires them to n8n webhooks.
