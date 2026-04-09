# Task: 04c-escalation-view

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

- [ ] Do NOT dismiss escalations automatically — require explicit acknowledgment
- [ ] Do NOT modify sentiment scores — display only

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_System_Instructions.md` (section 3 — Sentiment Analyst, section 5.2 — Escalation view), `docs/Siteware_Project_Status.md` (section 5 — escalation payload)

### 5. Memory

- [x] N/A

### 6. Success Criteria

- [ ] `EscalationView` component showing escalation alerts
- [ ] Each alert shows: sender, subject, sentiment score (color-coded), urgency level, risk flags (complaint, legal, churn)
- [ ] Sentiment score visualization: horizontal bar or color badge (-1.0 red to +1.0 green)
- [ ] Risk flags as colored badges: complaint (orange), legal threat (red), churn risk (yellow/orange/red)
- [ ] "Acknowledge" button — marks alert as seen
- [ ] "Assign" dropdown — placeholder for team member assignment
- [ ] Summary and recommended action displayed
- [ ] Sorted by severity (legal threats first, then sentiment score ascending)
- [ ] Verification: `npx tsc --noEmit` exits 0

### 7. Dependencies

- [x] Task 02 (types — EscalationAlert interface)
- [x] Task 03 (layout with tabs)

### 8. Failure Handling

**Max attempts:** 3
**On failure:** Simplify sentiment visualization — just show the number with color
**Rollback:** `git stash && git checkout HEAD~1`

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] Sentiment visualization needs a specific charting approach

---

## Human Checkpoint

- [x] **NONE** — proceed automatically

---

## Description

Build the escalation dashboard view. Shows emails that triggered escalation alerts based on negative sentiment, high urgency, complaint risk, legal threats, or churn risk.

## Steps

1. Create `src/components/email/SentimentBadge.tsx` — visual sentiment indicator
2. Create `src/components/email/RiskFlags.tsx` — badge group for complaint/legal/churn
3. Create `src/views/EscalationView.tsx` — alert cards with all sentiment data
4. Add acknowledge and assign actions
5. Sort by severity
6. Add mock escalation data
7. Connect to tab

## On Completion

- **Commit:** `feat: escalation view with sentiment visualization and risk flags`
- **Update:** CLAUDE.md
