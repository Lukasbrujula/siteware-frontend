# Task: Tenant-aware SMTP Send in Lane 2

## Status

- [x] Pending
- [ ] In Progress
- [ ] Verified
- [ ] Complete

## Pillars

### 1. Model

sonnet

### 2. Tools Required

- [x] Read, Edit, Write (file operations)
- [x] Bash: `python3` for JSON manipulation of n8n workflow

### 3. Guardrails (DO NOT)

- [ ] Do NOT use any Gmail-specific n8n nodes — must work with any IMAP/SMTP provider
- [ ] Do NOT hardcode any credentials in the workflow JSON
- [ ] Do NOT change Lane 1 nodes
- [ ] Do NOT change the webhook paths for approve/reject/retriage/unsubscribe

### 4. Knowledge (MUST READ)

- [x] Read the current workflow JSON — find the Lane 2 approve flow and the current Send Email node (which was removed/mocked after the Gmail node was deleted)
- [x] Read `api/tenants/[param].ts` — understand GET /api/tenants/:tenantId/config response shape
- [x] The dashboard Vercel URL is `https://siteware-email-dashboard.vercel.app`
- [x] Credentials come from: GET https://siteware-email-dashboard.vercel.app/api/tenants/{tenant_id}/config

### 5. Memory

- [x] The Gmail node was removed from Lane 2 because it was hardcoded to one account
- [x] The Auto-Archive node was also disabled — leave it disabled for now
- [x] Lane 2 currently has a "Respond to Webhook" node at the end — keep it
- [x] SMTP passwords are stored in plaintext in Turso for MVP (noted with TODO in code)

### 6. Success Criteria

- [ ] Lane 2 has a Code node that fetches tenant SMTP credentials from the dashboard API
- [ ] Code node sends email via nodemailer using tenant-specific SMTP credentials
- [ ] Send node reads `to`, `subject`, `body_html`, `body_plain` from incoming payload
- [ ] Send node reads `tenant_id` from incoming payload to look up credentials
- [ ] On send success, audit log is posted to dashboard
- [ ] On send failure, error is returned in webhook response (not silently swallowed)
- [ ] Works with Gmail SMTP (smtp.gmail.com:465) using app password
- [ ] Workflow JSON is valid and importable

### 7. Dependencies

- [ ] Task 1 must be complete (tenant credentials in Turso)
- [ ] GET /api/tenants/:tenantId/config must return smtp_host, smtp_port, smtp_user, smtp_password

### 8. Failure Handling

**Max attempts:** 3

**On SMTP send failure:**

- [ ] Return error in webhook response body: `{ success: false, error: "SMTP error message" }`
- [ ] Do NOT archive the email if send failed
- [ ] Log failure to dashboard audit endpoint

**After max attempts exhausted:**

- [ ] Save error to `ERRORS/task_03_smtp_send.md` and STOP

### 9. Learning

**Log to LEARNINGS.md if:**

- [x] nodemailer behaves differently in n8n Code nodes vs standalone Node.js
- [x] Gmail port 465 vs 587 differences encountered
- [x] `this.helpers.httpRequest()` has issues with the tenant config API

---

## Human Checkpoint

- [x] **NONE** - proceed automatically

---

## Description

Replace the missing/mock Send Email node in Lane 2 with a Code node that: (1) fetches SMTP credentials for the incoming tenant_id from the dashboard API, (2) sends the email using nodemailer with those credentials. This makes the send step fully tenant-aware — each tenant's emails are sent from their own account using their own credentials.

## Acceptance Criteria

- [ ] Lane 2 sends real emails using tenant SMTP credentials
- [ ] Works for the default tenant (margenfeldlukas@gmail.com / smtp.gmail.com:465)
- [ ] No hardcoded credentials anywhere in the workflow
- [ ] Approve flow works end-to-end: webhook → fetch creds → send → audit log → respond

## Code Node Implementation

The send node should follow this pattern:

```javascript
const helpers = this.helpers;
const data = $input.first().json;

const tenantId = data.tenant_id || "default";
const DASHBOARD_URL = "https://siteware-email-dashboard.vercel.app";

// Step 1: Fetch tenant SMTP credentials
const config = await helpers.httpRequest({
  method: "GET",
  url: `${DASHBOARD_URL}/api/tenants/${tenantId}/config`,
  headers: { "Content-Type": "application/json" },
});

if (!config.smtp_host) {
  throw new Error(`No SMTP credentials configured for tenant: ${tenantId}`);
}

// Step 2: Send via nodemailer
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: config.smtp_host,
  port: config.smtp_port,
  secure: config.smtp_port === 465,
  auth: {
    user: config.smtp_user,
    pass: config.smtp_password,
  },
});

const result = await transporter.sendMail({
  from: config.smtp_user,
  to: data.to,
  subject: data.subject,
  html: data.body_html,
  text: data.body_plain,
});

return [
  {
    json: {
      success: true,
      email_id: data.email_id,
      tenant_id: tenantId,
      to: data.to,
      messageId: result.messageId,
      response: result.response,
    },
  },
];
```

**Note on nodemailer in n8n Cloud:** n8n Cloud Code nodes have nodemailer available as a built-in module. If not available, use `this.helpers.httpRequest()` to call a lightweight send endpoint on the dashboard backend instead.

## On Completion

- **Commit:** `feat: tenant-aware SMTP send in Lane 2`
- **Handoff notes:** The GET /api/tenants/:tenantId/config endpoint currently redacts smtp_password for security. Update `api/tenants/[param].ts` to return smtp credentials when called from n8n (consider adding a server-to-server auth header to distinguish internal calls from browser requests).
