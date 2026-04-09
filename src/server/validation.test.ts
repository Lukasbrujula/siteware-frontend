import { describe, it, expect } from "vitest";
import {
  validateSpamAdPayload,
  validateDraftPayload,
  validateEscalationPayload,
  validateUnsubscribePayload,
} from "./validation.ts";

// ---------------------------------------------------------------------------
// Factories — valid payloads
// ---------------------------------------------------------------------------

function validSpamPayload(overrides: Record<string, unknown> = {}) {
  return {
    workflow: "email_inbox",
    category: "SPAM",
    email_id: "spam-001",
    sender_name: "Max Mustermann",
    sender_email: "max@example.com",
    sender_domain: "example.com",
    subject: "Win a prize!",
    preview: "Click here to claim your prize",
    date: "2025-06-01T10:00:00Z",
    confidence: 0.95,
    low_confidence: false,
    reasoning: "Known spam pattern detected",
    list_unsubscribe_url: null,
    list_unsubscribe_mailto: null,
    unsubscribe_available: false,
    ...overrides,
  };
}

function validDraftPayload(overrides: Record<string, unknown> = {}) {
  return {
    workflow: "email_inbox",
    category: "URGENT",
    email_id: "urgent-001",
    sender_name: "Customer A",
    sender_email: "customer@example.com",
    subject: "Re: Invoice #1234",
    original_subject: "Invoice #1234",
    original_preview: "Please check the attached invoice.",
    draft_html: "<p>Dear Customer,</p>",
    draft_plain: "Dear Customer,",
    placeholders: ["[BITTE ERGÄNZEN: Name]"],
    reply_language: "de",
    confidence: 0.75,
    review_reason: "Contains placeholder",
    requires_human_review: true,
    low_confidence: false,
    is_escalated: false,
    sentiment_score: 0.2,
    date: "2025-06-01T10:00:00Z",
    timestamp: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

function validEscalationPayload(overrides: Record<string, unknown> = {}) {
  return {
    workflow: "email_inbox",
    category: "ESCALATION",
    email_id: "esc-001",
    sender_name: "Angry Customer",
    sender_email: "angry@example.com",
    subject: "Legal action pending",
    sentiment_score: -0.8,
    urgency: 5,
    complaint_risk: true,
    legal_threat: true,
    churn_risk: "high",
    summary: "Customer is threatening legal action.",
    timestamp: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

function validUnsubscribePayload(overrides: Record<string, unknown> = {}) {
  return {
    email_id: "unsub-001",
    sender: "newsletter@example.com",
    unsubscribe_method: "one-click",
    status: "erfolgreich",
    reason: "Unsubscribe link found",
    timestamp: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

// ===========================================================================
// validateSpamAdPayload
// ===========================================================================

describe("validateSpamAdPayload", () => {
  it("accepts a valid SPAM payload", () => {
    const result = validateSpamAdPayload(validSpamPayload());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.category).toBe("SPAM");
      expect(result.data.email_id).toBe("spam-001");
    }
  });

  it("accepts a valid AD payload", () => {
    const result = validateSpamAdPayload(validSpamPayload({ category: "AD" }));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.category).toBe("AD");
    }
  });

  it("rejects non-object body (null)", () => {
    const result = validateSpamAdPayload(null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("Body must be a JSON object");
  });

  it("rejects non-object body (string)", () => {
    const result = validateSpamAdPayload("not an object");
    expect(result.valid).toBe(false);
  });

  it("rejects non-object body (array)", () => {
    const result = validateSpamAdPayload([1, 2, 3]);
    expect(result.valid).toBe(false);
  });

  it("rejects wrong workflow", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ workflow: "wrong" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"workflow" must be "email_inbox"');
  });

  it("rejects wrong category", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ category: "URGENT" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"category" must be "SPAM" or "AD"');
  });

  it("rejects empty email_id", () => {
    const result = validateSpamAdPayload(validSpamPayload({ email_id: "" }));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"email_id" must be a non-empty string');
  });

  it("rejects email_id exceeding 200 chars", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ email_id: "x".repeat(201) }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"email_id" exceeds maximum length of 200',
      );
  });

  it("rejects non-string email_id", () => {
    const result = validateSpamAdPayload(validSpamPayload({ email_id: 123 }));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"email_id" must be a non-empty string');
  });

  it("rejects confidence below 0", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ confidence: -0.1 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"confidence" must be between 0 and 1');
  });

  it("rejects confidence above 1", () => {
    const result = validateSpamAdPayload(validSpamPayload({ confidence: 1.1 }));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"confidence" must be between 0 and 1');
  });

  it("rejects NaN confidence", () => {
    const result = validateSpamAdPayload(validSpamPayload({ confidence: NaN }));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"confidence" must be a finite number');
  });

  it("rejects Infinity confidence", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ confidence: Infinity }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"confidence" must be a finite number');
  });

  it("accepts confidence boundary 0", () => {
    const result = validateSpamAdPayload(validSpamPayload({ confidence: 0 }));
    expect(result.valid).toBe(true);
  });

  it("accepts confidence boundary 1", () => {
    const result = validateSpamAdPayload(validSpamPayload({ confidence: 1 }));
    expect(result.valid).toBe(true);
  });

  it("rejects non-boolean low_confidence", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ low_confidence: "yes" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"low_confidence" must be a boolean');
  });

  it("accepts null list_unsubscribe_url", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ list_unsubscribe_url: null }),
    );
    expect(result.valid).toBe(true);
  });

  it("accepts string list_unsubscribe_url", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ list_unsubscribe_url: "https://example.com/unsub" }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects non-string non-null list_unsubscribe_url", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ list_unsubscribe_url: 123 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"list_unsubscribe_url" must be a string or null',
      );
  });

  it("rejects list_unsubscribe_url exceeding max length", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ list_unsubscribe_url: "x".repeat(2001) }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"list_unsubscribe_url" exceeds maximum length of 2000',
      );
  });

  it('joins multiple errors with "; "', () => {
    const result = validateSpamAdPayload({
      workflow: "wrong",
      category: "WRONG",
      email_id: 123,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("; ");
      const errors = result.error.split("; ");
      expect(errors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("rejects subject exceeding max length", () => {
    const result = validateSpamAdPayload(
      validSpamPayload({ subject: "x".repeat(1001) }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"subject" exceeds maximum length of 1000',
      );
  });

  it("returns typed data on success with all fields", () => {
    const payload = validSpamPayload({
      list_unsubscribe_url: "https://x.com/unsub",
    });
    const result = validateSpamAdPayload(payload);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.list_unsubscribe_url).toBe("https://x.com/unsub");
      expect(result.data.workflow).toBe("email_inbox");
    }
  });
});

// ===========================================================================
// validateDraftPayload
// ===========================================================================

describe("validateDraftPayload", () => {
  it("accepts a valid URGENT draft", () => {
    const result = validateDraftPayload(validDraftPayload());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.category).toBe("URGENT");
    }
  });

  it("accepts a valid OTHER draft", () => {
    const result = validateDraftPayload(
      validDraftPayload({ category: "OTHER" }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.category).toBe("OTHER");
    }
  });

  it("rejects non-object body", () => {
    const result = validateDraftPayload(42);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("Body must be a JSON object");
  });

  it("rejects SPAM category", () => {
    const result = validateDraftPayload(
      validDraftPayload({ category: "SPAM" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"category" must be "URGENT" or "OTHER"');
  });

  it("detects <script> in draft_html", () => {
    const result = validateDraftPayload(
      validDraftPayload({
        draft_html: '<p>Hello</p><script>alert("xss")</script>',
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("dangerous HTML");
  });

  it("detects onclick= in draft_html", () => {
    const result = validateDraftPayload(
      validDraftPayload({ draft_html: '<p onclick="alert(1)">Hello</p>' }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("dangerous HTML");
  });

  it("detects javascript: in draft_html", () => {
    const result = validateDraftPayload(
      validDraftPayload({
        draft_html: '<a href="javascript:void(0)">Click</a>',
      }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("dangerous HTML");
  });

  it("accepts safe HTML in draft_html", () => {
    const result = validateDraftPayload(
      validDraftPayload({ draft_html: "<p>Sehr geehrte Damen und Herren</p>" }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects non-array placeholders", () => {
    const result = validateDraftPayload(
      validDraftPayload({ placeholders: "not an array" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"placeholders" must be an array');
  });

  it("rejects placeholders containing non-strings", () => {
    const result = validateDraftPayload(
      validDraftPayload({ placeholders: [123, null] }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"placeholders" must contain only strings',
      );
  });

  it("accepts empty placeholders array", () => {
    const result = validateDraftPayload(
      validDraftPayload({ placeholders: [] }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects invalid reply_language", () => {
    const result = validateDraftPayload(
      validDraftPayload({ reply_language: "fr" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"reply_language" must be "de" or "en"');
  });

  it('accepts reply_language "en"', () => {
    const result = validateDraftPayload(
      validDraftPayload({ reply_language: "en" }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects non-string reply_language", () => {
    const result = validateDraftPayload(
      validDraftPayload({ reply_language: 123 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"reply_language" must be a string');
  });

  it("rejects draft_html exceeding 100K", () => {
    const result = validateDraftPayload(
      validDraftPayload({ draft_html: "x".repeat(100_001) }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"draft_html" exceeds maximum length of 100000',
      );
  });

  it("rejects sentiment_score below -1", () => {
    const result = validateDraftPayload(
      validDraftPayload({ sentiment_score: -1.1 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"sentiment_score" must be between -1 and 1',
      );
  });

  it("rejects sentiment_score above 1", () => {
    const result = validateDraftPayload(
      validDraftPayload({ sentiment_score: 1.1 }),
    );
    expect(result.valid).toBe(false);
  });

  it("accepts sentiment_score at boundaries", () => {
    expect(
      validateDraftPayload(validDraftPayload({ sentiment_score: -1 })).valid,
    ).toBe(true);
    expect(
      validateDraftPayload(validDraftPayload({ sentiment_score: 1 })).valid,
    ).toBe(true);
  });

  it("rejects non-boolean requires_human_review", () => {
    const result = validateDraftPayload(
      validDraftPayload({ requires_human_review: "yes" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"requires_human_review" must be a boolean',
      );
  });

  it("returns immutable placeholders copy", () => {
    const placeholders = ["[BITTE ERGÄNZEN: Name]"];
    const result = validateDraftPayload(validDraftPayload({ placeholders }));
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.placeholders).toEqual(placeholders);
      expect(result.data.placeholders).not.toBe(placeholders);
    }
  });
});

// ===========================================================================
// validateEscalationPayload
// ===========================================================================

describe("validateEscalationPayload", () => {
  it("accepts a valid escalation", () => {
    const result = validateEscalationPayload(validEscalationPayload());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.category).toBe("ESCALATION");
      expect(result.data.legal_threat).toBe(true);
    }
  });

  it("rejects non-object body", () => {
    const result = validateEscalationPayload(undefined);
    expect(result.valid).toBe(false);
  });

  it("rejects wrong category", () => {
    const result = validateEscalationPayload(
      validEscalationPayload({ category: "SPAM" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"category" must be "ESCALATION"');
  });

  it("rejects urgency below 0", () => {
    const result = validateEscalationPayload(
      validEscalationPayload({ urgency: -1 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"urgency" must be between 0 and 10');
  });

  it("rejects urgency above 10", () => {
    const result = validateEscalationPayload(
      validEscalationPayload({ urgency: 11 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"urgency" must be between 0 and 10');
  });

  it("accepts urgency boundary values", () => {
    expect(
      validateEscalationPayload(validEscalationPayload({ urgency: 0 })).valid,
    ).toBe(true);
    expect(
      validateEscalationPayload(validEscalationPayload({ urgency: 10 })).valid,
    ).toBe(true);
  });

  it("rejects invalid churn_risk", () => {
    const result = validateEscalationPayload(
      validEscalationPayload({ churn_risk: "critical" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"churn_risk" must be "low", "medium", or "high"',
      );
  });

  it("rejects non-string churn_risk", () => {
    const result = validateEscalationPayload(
      validEscalationPayload({ churn_risk: 42 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"churn_risk" must be a string');
  });

  it("accepts all valid churn_risk values", () => {
    for (const risk of ["low", "medium", "high"]) {
      const result = validateEscalationPayload(
        validEscalationPayload({ churn_risk: risk }),
      );
      expect(result.valid).toBe(true);
    }
  });

  it("rejects non-boolean complaint_risk", () => {
    const result = validateEscalationPayload(
      validEscalationPayload({ complaint_risk: "yes" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"complaint_risk" must be a boolean');
  });

  it("rejects non-boolean legal_threat", () => {
    const result = validateEscalationPayload(
      validEscalationPayload({ legal_threat: 1 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"legal_threat" must be a boolean');
  });

  it("rejects sentiment_score out of range", () => {
    const result = validateEscalationPayload(
      validEscalationPayload({ sentiment_score: -1.5 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"sentiment_score" must be between -1 and 1',
      );
  });

  it("rejects summary exceeding 10K", () => {
    const result = validateEscalationPayload(
      validEscalationPayload({ summary: "x".repeat(10_001) }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"summary" exceeds maximum length of 10000',
      );
  });
});

// ===========================================================================
// validateUnsubscribePayload
// ===========================================================================

describe("validateUnsubscribePayload", () => {
  it("accepts a valid unsubscribe payload", () => {
    const result = validateUnsubscribePayload(validUnsubscribePayload());
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.status).toBe("erfolgreich");
      expect(result.data.unsubscribe_method).toBe("one-click");
    }
  });

  it("rejects non-object body", () => {
    const result = validateUnsubscribePayload(false);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe("Body must be a JSON object");
  });

  it("rejects empty email_id", () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ email_id: "" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"email_id" must be a non-empty string');
  });

  it("rejects empty sender", () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ sender: "" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"sender" must be a non-empty string');
  });

  it('accepts "nicht erfolgreich" status', () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ status: "nicht erfolgreich" }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.status).toBe("nicht erfolgreich");
  });

  it("rejects invalid status", () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ status: "pending" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"status" must be "erfolgreich" or "nicht erfolgreich"',
      );
  });

  it("rejects non-string status", () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ status: true }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"status" must be a string');
  });

  it('accepts "mailto" method', () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ unsubscribe_method: "mailto" }),
    );
    expect(result.valid).toBe(true);
  });

  it('accepts "not-found" method', () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ unsubscribe_method: "not-found" }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects invalid unsubscribe_method", () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ unsubscribe_method: "api" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain(
        '"unsubscribe_method" must be "one-click", "mailto", or "not-found"',
      );
  });

  it("rejects non-string unsubscribe_method", () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ unsubscribe_method: null }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"unsubscribe_method" must be a string');
  });

  it("rejects reason exceeding max length", () => {
    const result = validateUnsubscribePayload(
      validUnsubscribePayload({ reason: "x".repeat(5001) }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('"reason" exceeds maximum length');
  });

  it('joins multiple errors with "; "', () => {
    const result = validateUnsubscribePayload({
      email_id: "",
      sender: "",
      unsubscribe_method: "invalid",
      status: "invalid",
      reason: "",
      timestamp: "",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const errors = result.error.split("; ");
      expect(errors.length).toBeGreaterThanOrEqual(4);
    }
  });
});
