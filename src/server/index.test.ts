import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { app } from "./index.ts";
import { __resetClientsForTest } from "./sse.ts";
import { initDb, closeDb } from "./db.ts";

// Suppress audit log output during tests
beforeEach(() => {
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  __resetClientsForTest();
  initDb(":memory:");
});

afterEach(() => {
  closeDb();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Valid payload factories
// ---------------------------------------------------------------------------

function validSpamPayload() {
  return {
    workflow: "email_inbox",
    category: "SPAM",
    email_id: `spam-${Date.now()}`,
    sender_name: "Spammer",
    sender_email: "spam@example.com",
    sender_domain: "example.com",
    subject: "Win!",
    preview: "Click here",
    date: "2025-06-01T10:00:00Z",
    confidence: 0.9,
    low_confidence: false,
    reasoning: "Spam pattern",
    list_unsubscribe_url: null,
    list_unsubscribe_mailto: null,
    unsubscribe_available: false,
  };
}

function validDraftPayload() {
  return {
    workflow: "email_inbox",
    category: "URGENT",
    email_id: `draft-${Date.now()}`,
    sender_name: "Customer",
    sender_email: "customer@example.com",
    subject: "Re: Invoice",
    original_subject: "Invoice",
    original_preview: "Check invoice.",
    draft_html: "<p>Dear Customer,</p>",
    draft_plain: "Dear Customer,",
    placeholders: [],
    reply_language: "de",
    confidence: 0.8,
    review_reason: "Review needed",
    requires_human_review: true,
    low_confidence: false,
    is_escalated: false,
    sentiment_score: 0.2,
    date: "2025-06-01T10:00:00Z",
    timestamp: "2025-06-01T10:00:00Z",
  };
}

function validEscalationPayload() {
  return {
    workflow: "email_inbox",
    category: "ESCALATION",
    email_id: `esc-${Date.now()}`,
    sender_name: "Angry Customer",
    sender_email: "angry@example.com",
    subject: "Legal action",
    sentiment_score: -0.8,
    urgency: 5,
    complaint_risk: true,
    legal_threat: true,
    churn_risk: "high",
    summary: "Customer threatening legal action.",
    timestamp: "2025-06-01T10:00:00Z",
  };
}

function validUnsubscribePayload() {
  return {
    email_id: `unsub-${Date.now()}`,
    sender: "newsletter@example.com",
    unsubscribe_method: "one-click",
    status: "erfolgreich",
    reason: "Unsubscribe link found",
    timestamp: "2025-06-01T10:00:00Z",
  };
}

function validAuditPayload() {
  return {
    action: "draft_approved",
    email_id: "email-001",
    result: "success",
  };
}

// ===========================================================================
// GET /api/health
// ===========================================================================

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.clients).toBe("number");
  });
});

// ===========================================================================
// POST /api/email/:category — spam
// ===========================================================================

describe("POST /api/email/spam", () => {
  it("accepts valid spam payload", async () => {
    const res = await request(app)
      .post("/api/email/spam")
      .send(validSpamPayload());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects invalid payload with 422", async () => {
    const res = await request(app)
      .post("/api/email/spam")
      .send({ workflow: "wrong" });
    expect(res.status).toBe(422);
    expect(res.body.error).toBeDefined();
  });

  it("rejects AD payload on /spam route (category mismatch)", async () => {
    const adPayload = validSpamPayload();
    adPayload.category = "AD";
    const res = await request(app).post("/api/email/spam").send(adPayload);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Category mismatch");
  });
});

// ===========================================================================
// POST /api/email/ad
// ===========================================================================

describe("POST /api/email/ad", () => {
  it("accepts valid AD payload", async () => {
    const payload = validSpamPayload();
    payload.category = "AD";
    const res = await request(app).post("/api/email/ad").send(payload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects SPAM payload on /ad route", async () => {
    const res = await request(app)
      .post("/api/email/ad")
      .send(validSpamPayload());
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Category mismatch");
  });
});

// ===========================================================================
// POST /api/email/draft
// ===========================================================================

describe("POST /api/email/draft", () => {
  it("accepts URGENT draft", async () => {
    const res = await request(app)
      .post("/api/email/draft")
      .send(validDraftPayload());
    expect(res.status).toBe(200);
  });

  it("accepts OTHER draft", async () => {
    const payload = validDraftPayload();
    payload.category = "OTHER";
    const res = await request(app).post("/api/email/draft").send(payload);
    expect(res.status).toBe(200);
  });

  it("rejects SPAM on /draft route", async () => {
    const payload = validDraftPayload();
    payload.category = "SPAM" as "URGENT";
    const res = await request(app).post("/api/email/draft").send(payload);
    expect(res.status).toBe(422);
  });
});

// ===========================================================================
// POST /api/email/escalation
// ===========================================================================

describe("POST /api/email/escalation", () => {
  it("accepts valid escalation", async () => {
    const res = await request(app)
      .post("/api/email/escalation")
      .send(validEscalationPayload());
    expect(res.status).toBe(200);
  });

  it("rejects invalid escalation", async () => {
    const res = await request(app)
      .post("/api/email/escalation")
      .send({ workflow: "email_inbox", category: "ESCALATION" });
    expect(res.status).toBe(422);
  });
});

// ===========================================================================
// POST /api/email/unsubscribe
// ===========================================================================

describe("POST /api/email/unsubscribe", () => {
  it("accepts valid unsubscribe", async () => {
    const res = await request(app)
      .post("/api/email/unsubscribe")
      .send(validUnsubscribePayload());
    expect(res.status).toBe(200);
  });

  it("rejects invalid unsubscribe", async () => {
    const res = await request(app)
      .post("/api/email/unsubscribe")
      .send({ email_id: "" });
    expect(res.status).toBe(422);
  });
});

// ===========================================================================
// Unknown category
// ===========================================================================

describe("POST /api/email/:category — unknown", () => {
  it("returns 400 for unknown category", async () => {
    const res = await request(app).post("/api/email/unknown").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid category");
  });
});

// ===========================================================================
// POST /api/audit
// ===========================================================================

describe("POST /api/audit", () => {
  it("accepts valid audit payload", async () => {
    const res = await request(app)
      .post("/api/email/audit")
      .send(validAuditPayload());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects invalid audit action", async () => {
    const res = await request(app)
      .post("/api/email/audit")
      .send({ action: "invalid", email_id: "x", result: "success" });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Invalid action");
  });

  it("rejects missing email_id", async () => {
    const res = await request(app)
      .post("/api/email/audit")
      .send({ action: "draft_approved", result: "success" });
    expect(res.status).toBe(422);
  });

  it("rejects invalid result", async () => {
    const res = await request(app)
      .post("/api/email/audit")
      .send({ action: "draft_approved", email_id: "x", result: "maybe" });
    expect(res.status).toBe(422);
  });
});
