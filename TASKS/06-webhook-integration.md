# Task: 06-webhook-integration

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

- [ ] Do NOT hardcode webhook URLs — use environment variables
- [ ] Do NOT send webhooks without user confirmation (approve dialog)
- [ ] Do NOT swallow errors silently — show toast notifications for success/failure
- [ ] Do NOT auto-retry failed webhooks — let user manually retry

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_Project_Status.md` (section 4 — webhook endpoints, section 5 — payload shapes), `docs/Siteware_System_Instructions.md` (section 6 — workflow behavior rules)

### 5. Memory

- [x] N/A

### 6. Success Criteria

- [ ] `src/lib/api/webhooks.ts` — typed functions for all 4 webhook calls
- [ ] `approveDraft(emailId, draftHtml, draftPlain, senderEmail, subject)` → POST /webhook/approve-draft
- [ ] `rejectDraft(emailId, reason?)` → POST /webhook/reject-draft
- [ ] `retriage(emailData)` → POST /webhook/retriage
- [ ] `unsubscribe(emailId, senderEmail, unsubUrl?, unsubMailto?)` → POST /webhook/unsubscribe
- [ ] All functions use `N8N_WEBHOOK_BASE_URL` from env
- [ ] Success/error handling with toast notifications (shadcn Sonner or similar)
- [ ] Loading states on buttons during webhook calls
- [ ] Approve button in DraftReviewView wired to `approveDraft()`
- [ ] Reject button wired to `rejectDraft()`
- [ ] Move to Inbox button wired to `retriage()`
- [ ] Unsubscribe button wired to `unsubscribe()`
- [ ] After successful approve: remove draft from store (auto-archive behavior)
- [ ] After successful reject: remove draft from store
- [ ] After successful retriage: remove from spam/ad, email re-enters triage
- [ ] Verification: `npx tsc --noEmit` exits 0

### 7. Dependencies

- [x] Task 04a (spam/ad views — retriage and unsubscribe buttons)
- [x] Task 04b (draft views — approve and reject buttons)
- [x] Task 05 (mock data for testing)

### 8. Failure Handling

**Max attempts:** 3
**On failure:** Ensure graceful degradation — buttons work, errors shown, store not corrupted
**Rollback:** `git stash && git checkout HEAD~1`

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] n8n webhook response format differs from expected
- [ ] CORS issues with n8n webhook calls from browser — note solution

---

## Human Checkpoint

- [ ] **PAUSE** before first real webhook test — verify n8n workflow is active and webhook URLs are correct

---

## Description

Wire all dashboard actions to n8n webhook endpoints. This is where the dashboard becomes functional — user actions (approve, reject, retriage, unsubscribe) trigger real n8n workflow executions.

## Steps

1. Create `src/lib/api/webhooks.ts` — webhook client functions
2. Add toast notification system (shadcn Sonner)
3. Wire Approve button → `approveDraft()` → update store on success
4. Wire Reject button → `rejectDraft()` → update store on success
5. Wire Move to Inbox → `retriage()` → remove from category
6. Wire Unsubscribe → `unsubscribe()` → update status in store
7. Add loading spinners on all action buttons
8. Add error handling with user-visible toasts
9. Test with mock server from Task 05 (or real n8n if available)

## On Completion

- **Commit:** `feat: wire dashboard actions to n8n webhook endpoints`
- **Update:** CLAUDE.md
- **Handoff notes:** Dashboard is now fully functional with n8n. Next step is data ingestion (Task 07).
