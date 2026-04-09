# Siteware Email Inbox Automation — Project Status

**Version:** 1.0 | **Date:** March 2, 2026 | Confidential

---

## 1. Architecture

Three layers:

- **n8n Workflow Engine:** 5 lanes — email ingestion, classification, reply drafting, approval/rejection, re-triage, unsubscribe.
- **Siteware AI Layer:** POST /v1/api/completion, model: claude-opus-4-6. Triage, sentiment, reply composition.
- **React Dashboard:** Frontend UI embedded in Siteware (SiteFlow pattern). Communicates with n8n via webhook endpoints.

## 2. n8n Workflow Status

46 nodes across 5 lanes:

| Lane   | Function                      | Status   | Notes                                                                  |
| ------ | ----------------------------- | -------- | ---------------------------------------------------------------------- |
| Lane 1 | IMAP → Triage → Route → Draft | **DONE** | 23 nodes. Tested end-to-end with Siteware API. Dashboard nodes mocked. |
| Lane 2 | Approve → Send → Archive      | **MOCK** | 5 nodes. SMTP send + auto-archive mocked. Webhook ready.               |
| Lane 3 | Reject Draft                  | **MOCK** | 3 nodes. Reject + log. Webhook ready.                                  |
| Lane 4 | Re-Triage                     | **MOCK** | 6 nodes. Re-calls Siteware API. Dashboard mock.                        |
| Lane 5 | Unsubscribe                   | **MOCK** | 7 nodes. Detects method (URL/mailto). Execution mocked.                |

## 3. Siteware API Configuration

| Setting     | Value                                                |
| ----------- | ---------------------------------------------------- |
| Base URL    | `https://stagingapi.siteware.io`                     |
| Endpoint    | `POST /v1/api/completion` (simple, no agent)         |
| Auth        | `Authorization` header, raw token (no Bearer prefix) |
| Model       | `claude-opus-4-6`                                    |
| Body format | n8n bodyParameters (fields), NOT raw JSON            |
| Response    | `answer` field, string (may include markdown fences) |
| Cost        | ~€0.10 triage, ~€0.19 reply composition              |

**Known issues:** Staging 502s (retry resolves). n8n Switch node v3 routing bug (replaced with Code node).

## 4. Webhook Endpoints (n8n → Dashboard)

These are the n8n webhook paths the dashboard needs to call:

| Webhook     | Method | Path                     | Purpose                                    |
| ----------- | ------ | ------------------------ | ------------------------------------------ |
| Approve     | POST   | `/webhook/approve-draft` | User approves a draft reply                |
| Reject      | POST   | `/webhook/reject-draft`  | User rejects a draft reply                 |
| Re-Triage   | POST   | `/webhook/retriage`      | User moves email back for reclassification |
| Unsubscribe | POST   | `/webhook/unsubscribe`   | User requests newsletter unsubscribe       |

## 5. Dashboard Data Payloads (n8n → Dashboard)

### Spam/Ad Payload

```json
{
  "workflow": "email_inbox",
  "category": "SPAM | AD",
  "email_id": "string",
  "sender_name": "string",
  "sender_email": "string",
  "sender_domain": "string",
  "subject": "string",
  "preview": "first 150 chars of body",
  "date": "ISO-8601",
  "confidence": 0.95,
  "low_confidence": false,
  "reasoning": "string",
  "list_unsubscribe_url": "string | null",
  "list_unsubscribe_mailto": "string | null",
  "unsubscribe_available": true | false
}
```

### Draft Payload (Urgent/Other)

```json
{
  "workflow": "email_inbox",
  "category": "URGENT | OTHER",
  "email_id": "string",
  "sender_name": "string",
  "sender_email": "string",
  "subject": "Re: original subject",
  "original_subject": "string",
  "original_preview": "first 200 chars",
  "draft_html": "<html>full draft</html>",
  "draft_plain": "plain text draft",
  "placeholders": ["[BITTE ERGÄNZEN: ...]"],
  "reply_language": "de | en",
  "confidence": 0.75,
  "review_reason": "string",
  "requires_human_review": true,
  "low_confidence": false,
  "is_escalated": true | false,
  "sentiment_score": -0.4,
  "date": "ISO-8601",
  "timestamp": "ISO-8601"
}
```

### Escalation Payload

```json
{
  "workflow": "email_inbox",
  "category": "ESCALATION",
  "email_id": "string",
  "sender_name": "string",
  "sender_email": "string",
  "subject": "string",
  "sentiment_score": -0.7,
  "urgency": 5,
  "complaint_risk": true,
  "legal_threat": false,
  "churn_risk": "high",
  "summary": "string",
  "timestamp": "ISO-8601"
}
```

### Unsubscribe Status Payload

```json
{
  "email_id": "string",
  "sender": "string",
  "unsubscribe_method": "one-click | mailto | not-found",
  "status": "erfolgreich | nicht erfolgreich",
  "reason": "string",
  "timestamp": "ISO-8601"
}
```

## 6. Open Questions for Andreas

1. Dashboard data ingestion pattern — does SiteFlow provide webhook endpoints, or build separate API?
2. SMS/voice notification API endpoints for escalation?
3. Dedicated Triage/Reply agents in SiteCreator, or keep using simple completion?
4. Cheaper model strings for triage?
5. Production base URL?
6. Preferred React component library for SiteFlow dashboards?

## 7. Environment Variables

| Variable                   | Status | Description                           |
| -------------------------- | ------ | ------------------------------------- |
| TRIAGE_AGENT_ID            | TODO   | Agent ID for Triage assistant         |
| REPLY_COMPOSER_AGENT_ID    | TODO   | Agent ID for Reply Composer           |
| SITEWARE_DASHBOARD_WEBHOOK | TODO   | Base URL for dashboard data ingestion |
| SITEWARE_API_URL           | DONE   | `https://stagingapi.siteware.io`      |
| ESCALATION_PHONE_NUMBER    | TODO   | Phone for SMS alerts                  |
| N8N_WEBHOOK_BASE_URL       | TODO   | Base URL for n8n webhook callbacks    |
