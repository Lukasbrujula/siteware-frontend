import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateAuditPayload, writeAuditLog } from "./audit.ts";
import type { AuditEvent } from "@/types/audit";

// ===========================================================================
// validateAuditPayload
// ===========================================================================

describe("validateAuditPayload", () => {
  const validPayload = {
    action: "draft_approved",
    email_id: "email-001",
    result: "success",
  };

  it("accepts a minimal valid payload", () => {
    const result = validateAuditPayload(validPayload);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.action).toBe("draft_approved");
      expect(result.data.email_id).toBe("email-001");
      expect(result.data.result).toBe("success");
    }
  });

  it("accepts all 10 valid actions", () => {
    const actions = [
      "draft_approved",
      "draft_rejected",
      "email_retriaged",
      "email_deleted",
      "unsubscribe_requested",
      "escalation_acknowledged",
      "escalation_assigned",
      "escalation_dismissed",
      "unsubscribe_retried",
      "email_ingested",
    ];

    for (const action of actions) {
      const result = validateAuditPayload({ ...validPayload, action });
      expect(result.valid).toBe(true);
    }
  });

  it("rejects invalid action", () => {
    const result = validateAuditPayload({
      ...validPayload,
      action: "invalid_action",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("Invalid action");
  });

  it("rejects missing action", () => {
    const result = validateAuditPayload({ email_id: "x", result: "success" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("Invalid action");
  });

  it("rejects empty email_id", () => {
    const result = validateAuditPayload({ ...validPayload, email_id: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("email_id is required");
  });

  it("rejects non-string email_id", () => {
    const result = validateAuditPayload({ ...validPayload, email_id: 123 });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain("email_id is required");
  });

  it("rejects missing email_id", () => {
    const result = validateAuditPayload({
      action: "draft_approved",
      result: "success",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects invalid result", () => {
    const result = validateAuditPayload({ ...validPayload, result: "pending" });
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toContain('result must be "success" or "failure"');
  });

  it('accepts "failure" result', () => {
    const result = validateAuditPayload({ ...validPayload, result: "failure" });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.result).toBe("failure");
  });

  it("includes optional category when present", () => {
    const result = validateAuditPayload({ ...validPayload, category: "SPAM" });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.category).toBe("SPAM");
  });

  it("excludes category when not a string", () => {
    const result = validateAuditPayload({ ...validPayload, category: 123 });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.category).toBeUndefined();
  });

  it("includes optional error when present", () => {
    const result = validateAuditPayload({
      ...validPayload,
      error: "Something went wrong",
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.error).toBe("Something went wrong");
  });

  it("excludes error when not a string", () => {
    const result = validateAuditPayload({ ...validPayload, error: 42 });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.error).toBeUndefined();
  });

  it("includes optional context object", () => {
    const result = validateAuditPayload({
      ...validPayload,
      context: { assigned_to: "Teamleitung" },
    });
    expect(result.valid).toBe(true);
    if (result.valid)
      expect(result.data.context).toEqual({ assigned_to: "Teamleitung" });
  });

  it("excludes context when not an object", () => {
    const result = validateAuditPayload({
      ...validPayload,
      context: "not-object",
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.context).toBeUndefined();
  });

  it("defaults result to success when omitted", () => {
    const result = validateAuditPayload({
      action: "draft_approved",
      email_id: "email-001",
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.result).toBe("success");
  });

  it("captures extra top-level fields into context", () => {
    const result = validateAuditPayload({
      action: "draft_approved",
      email_id: "email-001",
      result: "success",
      to: "user@example.com",
      timestamp: "2026-03-04T10:00:00Z",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.context).toEqual({
        to: "user@example.com",
        timestamp: "2026-03-04T10:00:00Z",
      });
    }
  });

  it("merges extra fields with existing context", () => {
    const result = validateAuditPayload({
      action: "email_retriaged",
      email_id: "email-002",
      result: "success",
      context: { source: "n8n" },
      new_classification: "URGENT",
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.context).toEqual({
        source: "n8n",
        new_classification: "URGENT",
      });
    }
  });

  it("rejects null body", () => {
    const result = validateAuditPayload(null);
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect(result.error).toBe("Request body must be a JSON object");
  });

  it("rejects undefined body", () => {
    const result = validateAuditPayload(undefined);
    expect(result.valid).toBe(false);
  });
});

// ===========================================================================
// writeAuditLog
// ===========================================================================

describe("writeAuditLog", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes JSON with audit: true", () => {
    const event: AuditEvent = {
      action: "email_ingested",
      email_id: "email-001",
      result: "success",
    };

    writeAuditLog(event);

    expect(writeSpy).toHaveBeenCalledOnce();
    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());

    expect(parsed.audit).toBe(true);
    expect(parsed.action).toBe("email_ingested");
    expect(parsed.email_id).toBe("email-001");
    expect(parsed.result).toBe("success");
    expect(parsed.timestamp).toBeDefined();
    expect(output.endsWith("\n")).toBe(true);
  });

  it("includes source_ip when provided", () => {
    const event: AuditEvent = {
      action: "draft_approved",
      email_id: "email-002",
      result: "success",
    };

    writeAuditLog(event, "192.168.1.1");

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.source_ip).toBe("192.168.1.1");
  });

  it("omits source_ip when not provided", () => {
    const event: AuditEvent = {
      action: "email_deleted",
      email_id: "email-003",
      result: "success",
    };

    writeAuditLog(event);

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.source_ip).toBeUndefined();
  });

  it("includes timestamp as ISO string", () => {
    const before = new Date().toISOString();

    writeAuditLog({
      action: "escalation_acknowledged",
      email_id: "esc-001",
      result: "success",
    });

    const after = new Date().toISOString();
    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());

    expect(parsed.timestamp >= before).toBe(true);
    expect(parsed.timestamp <= after).toBe(true);
  });

  it("preserves all event fields", () => {
    const event: AuditEvent = {
      action: "escalation_assigned",
      email_id: "esc-002",
      category: "ESCALATION",
      result: "success",
      context: { assigned_to: "Rechtsabteilung" },
    };

    writeAuditLog(event, "10.0.0.1");

    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());

    expect(parsed.category).toBe("ESCALATION");
    expect(parsed.context).toEqual({ assigned_to: "Rechtsabteilung" });
    expect(parsed.source_ip).toBe("10.0.0.1");
  });
});
