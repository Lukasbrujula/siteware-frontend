import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { emitAuditEvent } from "./audit";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("emitAuditEvent", () => {
  it("calls fetch with correct URL and method", () => {
    emitAuditEvent({
      action: "draft_approved",
      email_id: "e1",
      result: "success",
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/email/audit",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("sends event as JSON body", () => {
    const event = {
      action: "email_deleted" as const,
      email_id: "e2",
      category: "SPAM",
      result: "success" as const,
    };
    emitAuditEvent(event);

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual(event);
  });

  it("includes AbortSignal timeout", () => {
    emitAuditEvent({
      action: "draft_approved",
      email_id: "e1",
      result: "success",
    });

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].signal).toBeDefined();
  });

  it("does not throw when fetch rejects", () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));
    expect(() =>
      emitAuditEvent({
        action: "draft_approved",
        email_id: "e1",
        result: "success",
      }),
    ).not.toThrow();
  });

  it("does not throw when fetch throws synchronously", () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("sync error");
    });
    expect(() =>
      emitAuditEvent({
        action: "draft_approved",
        email_id: "e1",
        result: "success",
      }),
    ).not.toThrow();
  });
});
