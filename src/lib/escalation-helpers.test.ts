import { describe, it, expect } from "vitest";
import { sortBySeverity, formatTimestamp } from "./escalation-helpers";
import type { EscalationAlert } from "@/types/email";

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeAlert(overrides: Partial<EscalationAlert> = {}): EscalationAlert {
  return {
    workflow: "email_inbox",
    category: "ESCALATION",
    email_id: "esc-001",
    sender_name: "Test",
    sender_email: "test@example.com",
    subject: "Test",
    sentiment_score: -0.5,
    urgency: 3,
    complaint_risk: false,
    legal_threat: false,
    churn_risk: "low",
    summary: "Test summary",
    timestamp: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

// ===========================================================================
// sortBySeverity
// ===========================================================================

describe("sortBySeverity", () => {
  it("sorts legal_threat=true before legal_threat=false", () => {
    const a = makeAlert({ legal_threat: true, sentiment_score: 0.5 });
    const b = makeAlert({ legal_threat: false, sentiment_score: -0.9 });
    expect(sortBySeverity(a, b)).toBe(-1);
  });

  it("sorts legal_threat=false after legal_threat=true", () => {
    const a = makeAlert({ legal_threat: false });
    const b = makeAlert({ legal_threat: true });
    expect(sortBySeverity(a, b)).toBe(1);
  });

  it("uses sentiment_score as tiebreaker when both have legal_threat", () => {
    const a = makeAlert({ legal_threat: true, sentiment_score: -0.8 });
    const b = makeAlert({ legal_threat: true, sentiment_score: -0.3 });
    expect(sortBySeverity(a, b)).toBeLessThan(0);
  });

  it("uses sentiment_score when neither has legal_threat", () => {
    const a = makeAlert({ legal_threat: false, sentiment_score: -0.2 });
    const b = makeAlert({ legal_threat: false, sentiment_score: -0.9 });
    expect(sortBySeverity(a, b)).toBeGreaterThan(0);
  });

  it("returns 0 for equal items", () => {
    const a = makeAlert({ legal_threat: false, sentiment_score: -0.5 });
    const b = makeAlert({ legal_threat: false, sentiment_score: -0.5 });
    expect(sortBySeverity(a, b)).toBe(0);
  });

  it("sorts array correctly (legal_threat first, then most negative sentiment)", () => {
    const alerts = [
      makeAlert({ email_id: "c", legal_threat: false, sentiment_score: -0.1 }),
      makeAlert({ email_id: "a", legal_threat: true, sentiment_score: -0.9 }),
      makeAlert({ email_id: "b", legal_threat: true, sentiment_score: -0.3 }),
      makeAlert({ email_id: "d", legal_threat: false, sentiment_score: -0.8 }),
    ];
    const sorted = [...alerts].sort(sortBySeverity);
    expect(sorted.map((a) => a.email_id)).toEqual(["a", "b", "d", "c"]);
  });
});

// ===========================================================================
// formatTimestamp
// ===========================================================================

describe("formatTimestamp", () => {
  it("formats ISO timestamp to de-DE locale", () => {
    const result = formatTimestamp("2025-06-15T14:30:00Z");
    // de-DE format: DD.MM.YYYY, HH:MM
    expect(result).toMatch(/15\.06\.2025/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("formats another date correctly", () => {
    // Use a mid-day timestamp to avoid timezone-related date rollover
    const result = formatTimestamp("2025-01-15T12:00:00Z");
    expect(result).toMatch(/15\.01\.2025/);
  });

  it("handles different timezone offset display", () => {
    const result = formatTimestamp("2025-12-31T23:59:00Z");
    // Should contain the date in some de-DE format
    expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });
});
