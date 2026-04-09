# Task: 01-project-scaffold

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
- [x] Bash: `npm create vite@latest`, `npm install`, `npx tsc --noEmit`
- [ ] Grep, Glob
- [ ] WebFetch
- [ ] Task (sub-agents)

### 3. Guardrails (DO NOT)

- [ ] Do NOT choose Next.js — this is a SPA dashboard embedded in Siteware, not a public website
- [ ] Do NOT add authentication — Siteware platform handles auth externally
- [ ] Do NOT add a database — all data comes from n8n webhooks
- [ ] Do NOT install unnecessary dependencies — keep it lean

### 4. Knowledge (MUST READ)

- [x] CLAUDE.md (always)
- [ ] Specific files: `docs/Siteware_Knowledge_Base.md` (SiteFlow pattern), `docs/Siteware_Project_Status.md` (architecture overview)

### 5. Memory

- [x] N/A (fresh context)

### 6. Success Criteria

- [ ] React 18+ app scaffolded with Vite + TypeScript
- [ ] Tailwind CSS v4 configured and working
- [ ] shadcn/ui initialized with base components (Button, Card, Badge, Tabs, Table, Dialog, Textarea)
- [ ] Project structure created: `src/components/`, `src/views/`, `src/hooks/`, `src/lib/`, `src/types/`
- [ ] Environment variables file: `N8N_WEBHOOK_BASE_URL`, `DASHBOARD_API_PORT`
- [ ] Dev server starts without errors: `npm run dev`
- [ ] Verification: `npx tsc --noEmit` exits 0

### 7. Dependencies

- [x] None — this is the first task

### 8. Failure Handling

**Max attempts:** 3
**On failure:** Retry with different Vite template or fall back to CRA
**Rollback:** `rm -rf node_modules && npm install`

### 9. Learning

**Log to LEARNINGS.md if:**

- [ ] Tailwind v4 has issues with Vite — note workaround
- [ ] shadcn/ui init requires specific config for Vite (not Next.js)

---

## Human Checkpoint

- [x] **NONE** — proceed automatically

---

## Description

Scaffold the React dashboard project. This is an SPA (Single Page Application) that will be embedded inside Siteware's SiteFlow dashboard system. It communicates with n8n via webhooks. No SSR, no auth, no database.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** React 18+ with Vite
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui
- **State:** Zustand (installed now, used in Task 03)
- **HTTP:** Native fetch (no axios needed)

## Steps

1. Create Vite React-TS project
2. Install and configure Tailwind CSS v4
3. Initialize shadcn/ui with required components
4. Install Zustand (used later)
5. Create folder structure
6. Create `.env` file with placeholder variables
7. Create `src/types/email.ts` with TypeScript interfaces for all payloads (reference `docs/Siteware_Project_Status.md` section 5)
8. Verify build

## On Completion

- **Commit:** `feat: scaffold React dashboard with Vite + Tailwind + shadcn`
- **Update:** CLAUDE.md with project structure and commands
