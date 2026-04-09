# Task: 03-dashboard-layout

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
- [x] Bash: `npx tsc --noEmit`, `npm run dev`
- [x] Grep, Glob
- [ ] WebFetch
- [ ] Task (sub-agents)

### 3. Guardrails (DO NOT)

- [ ] Do NOT add real data fetching — use mock data from store
- [ ] Do NOT build the individual category views yet — just the shell with tabs
- [ ] Do NOT add webhook calls — those come in Task 06
- [ ] Do NOT overcomplicate — this is a simple tabbed layout, not a complex SPA router

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_System_Instructions.md` (section 5.1 — action counter, section 5.2 — category views), `docs/Siteware_Knowledge_Base.md` (SiteFlow description)

### 5. Memory

- [x] N/A

### 6. Success Criteria

- [ ] Main dashboard component with tabbed navigation: Spam, Werbung, Urgent, Other, Escalation, Unsubscribe
- [ ] Red badge on each tab showing count of pending items from Zustand store
- [ ] Aggregate action counter in the header (total across all categories)
- [ ] Active tab stored in UI store — persists when switching
- [ ] Each tab renders a placeholder component (e.g., `<SpamView />` with "Coming in Task 04")
- [ ] Clean, professional UI matching Siteware's dark/modern aesthetic
- [ ] Responsive: works at 1024px+ viewport widths
- [ ] Verification: `npx tsc --noEmit` exits 0, dev server renders without errors

### 7. Dependencies

- [x] Task 01 (scaffold)
- [x] Task 02 (types and store)

### 8. Failure Handling

**Max attempts:** 3
**On failure:** Simplify layout — drop responsive complexity, get tabs working first
**Rollback:** `git stash && git checkout HEAD~1`

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] shadcn Tabs component needs special config for badge overlays
- [ ] Zustand selector for action count causes re-render issues

---

## Human Checkpoint

- [x] **NONE** — proceed automatically

---

## Description

Build the main dashboard shell: header with aggregate action counter, tabbed navigation for all 6 email categories, and placeholder content areas. This is the frame that all category views will render inside.

## Steps

1. Create `src/components/layout/DashboardHeader.tsx` — logo area, title "Email Automation", aggregate badge
2. Create `src/components/layout/CategoryTabs.tsx` — 6 tabs with individual badges from store
3. Create `src/App.tsx` — compose header + tabs + content area
4. Create placeholder view components for each category
5. Seed the store with mock data so badges show non-zero counts
6. Style with Tailwind — dark sidebar or top nav, clean content area
7. Test tab switching and badge updates

## On Completion

- **Commit:** `feat: dashboard layout with tabbed navigation and action badges`
- **Update:** CLAUDE.md
