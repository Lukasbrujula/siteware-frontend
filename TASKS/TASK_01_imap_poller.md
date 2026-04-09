# Task: IMAP Poller Service

## Status

- [ ] Pending
- [ ] In Progress
- [x] Verified
- [ ] Complete

## Pillars

### 1. Model

sonnet

### 2. Tools Required

- [x] Read, Edit, Write (file operations)
- [x] Bash: `npm install`, `npm run build`, `node scripts/poller.js`
- [x] Grep, Glob (search existing codebase)

### 3. Guardrails (DO NOT)

- [ ] Do NOT store credentials in code or commit them to git
- [ ] Do NOT log email body content (log subject + email_id only)
- [ ] Do NOT mark emails as read before successful POST to n8n webhook
- [ ] Do NOT process emails already seen (use IMAP UNSEEN flag only)
- [ ] Do NOT modify any existing dashboard code

### 4. Knowledge (MUST READ)

- [x] Read `src/server/db-turso.ts` — understand tenants table schema and getTenantConfig()
- [x] Read `api/tenants/[param].ts` — understand the GET /api/tenants/:tenantId/config endpoint
- [x] Read the existing package.json to understand the project structure

### 5. Memory

- [x] N/A (fresh context)

### 6. Success Criteria

- [ ] `scripts/poller.js` exists and runs without errors: `node scripts/poller.js`
- [ ] Poller reads all tenants from Turso via GET /api/tenants (or direct Turso query)
- [ ] For each tenant with IMAP credentials configured, connects to their inbox
- [ ] Fetches only UNSEEN emails
- [ ] Marks each email as SEEN after successful POST to n8n webhook
- [ ] POSTs each email to n8n webhook with correct payload shape including tenant_id
- [ ] Handles connection failures per tenant gracefully — one tenant failing does not stop others
- [ ] Runs as a continuous loop with 5-minute interval (setInterval or while loop with sleep)
- [ ] railway.json or Procfile exists so Railway knows how to run it
- [ ] Default tenant seeded in Turso with real credentials (see Knowledge section)

### 7. Dependencies

- [ ] Turso database must have tenants table (already built in Task 0)
- [ ] n8n webhook URL must be known (see Notes below)
- [ ] `imapflow` npm package installed

### 8. Failure Handling

**Max attempts:** 3

**On failure per tenant:**

- [ ] Log error with tenant_id and continue to next tenant
- [ ] Never throw uncaught exceptions — wrap all per-tenant logic in try/catch

**On webhook POST failure:**

- [ ] Do NOT mark email as read — leave it UNSEEN so next poll picks it up
- [ ] Log failure with email subject and tenant_id

**After max attempts exhausted:**

- [ ] Save error to `ERRORS/task_01_imap_poller.md` and STOP

### 9. Learning

**Log to LEARNINGS.md if:**

- [x] imapflow behaves unexpectedly with Gmail
- [x] UNSEEN flag handling differs between providers
- [x] Railway deployment requires specific start command

---

## Human Checkpoint

- [x] **NONE** - proceed automatically

---

## Description

Build a polling service that runs every 5 minutes, reads all tenants from Turso, connects to each tenant's IMAP inbox, fetches unseen emails, and POSTs them to the single n8n webhook with tenant_id included. This replaces the need for per-tenant n8n workflow instances and is the core of the multi-tenant architecture.

## Acceptance Criteria

- [ ] Poller runs continuously on Railway as a single process
- [ ] Processes emails from all tenants through one n8n workflow
- [ ] Default tenant (Lukas) receives and processes real emails end-to-end
- [ ] No credentials in git — all via environment variables

## Implementation Details

**Default tenant to seed into Turso:**

```
tenant_id: "default"
imap_host: "imap.gmail.com"
imap_port: 993
imap_user: "margenfeldlukas@gmail.com"
imap_password: "mljw wmke fknp nnhr"
smtp_host: "smtp.gmail.com"
smtp_port: 465
smtp_user: "margenfeldlukas@gmail.com"
smtp_password: "xdye dmgq pinz ilix"
triage_agent_id: "69a793b549b400eda5ba1d28"
reply_composer_agent_id: "69a79a7474b96c80ef1a84e2"
siteware_token: (read from SITEWARE_AUTH_TOKEN env var)
```

**n8n webhook URL:** `https://siteware.app.n8n.cloud/webhook/[WEBHOOK_ID]`
NOTE: The webhook ID comes from the new Webhook Trigger node added in Task 2.
For now use a placeholder and update after Task 2 is complete.
Store as env var: `N8N_WEBHOOK_URL`

**Payload shape to POST to n8n:**

```json
{
  "tenant_id": "default",
  "email_id": "<message-id-from-headers>",
  "sender_name": "Display Name",
  "sender_email": "sender@example.com",
  "subject": "Email subject",
  "body_plain": "Plain text body",
  "body_html": "<html>...</html>",
  "received_at": "2026-03-04T12:00:00.000Z",
  "has_attachments": false,
  "headers": "raw headers string"
}
```

**imapflow connection config:**

```javascript
{
  host: tenant.imap_host,
  port: tenant.imap_port,
  secure: true,
  auth: {
    user: tenant.imap_user,
    pass: tenant.imap_password
  },
  logger: false
}
```

**Railway environment variables needed:**

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `N8N_WEBHOOK_URL`
- `SITEWARE_AUTH_TOKEN`

**File structure:**

```
scripts/
  poller.js        ← main entry point (CommonJS or ESM)
  lib/
    imap-client.js ← imapflow wrapper
    db-client.js   ← Turso client for reading tenants
railway.json       ← { "build": { "builder": "nixpacks" }, "deploy": { "startCommand": "node scripts/poller.js" } }
```

## On Completion

- **Commit:** `feat: add IMAP poller service for multi-tenant email processing`
- **Update:** [ ] PROJECT_SCOPE.md
- **Handoff notes:** N8N_WEBHOOK_URL will be a placeholder until Task 2 is complete. Update the Railway env var after Task 2.

## Notes

- imapflow is already likely in package.json from the onboarding IMAP scan work — check before installing
- The poller should query Turso directly (using @libsql/client) rather than going through the HTTP API to avoid latency and rate limits
- Only process tenants where imap_host IS NOT NULL — skip tenants without IMAP configured
