import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  approveDraft,
  rejectDraft,
  retriage,
  unsubscribe,
  WebhookError,
} from "./webhooks";
import type {
  ApproveDraftPayload,
  RejectDraftPayload,
  RetriagePayload,
  UnsubscribePayload,
} from "./webhooks";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function okJson(body: Record<string, unknown> = {}) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function failJson(status: number, body: Record<string, unknown> = {}) {
  return { ok: false, status, json: () => Promise.resolve(body) };
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const approvePayload: ApproveDraftPayload = {
  email_id: "email-001",
  draft_html: "<p>Reply</p>",
  draft_plain: "Reply",
  sender_email: "customer@example.com",
  subject: "Re: Invoice",
  reply_language: "de",
};

const rejectPayload: RejectDraftPayload = {
  email_id: "email-001",
  reason: "Poor quality",
};

const retriagePayload: RetriagePayload = {
  email_id: "email-001",
  sender_email: "sender@example.com",
  subject: "Subject",
  original_category: "SPAM",
};

const unsubscribePayload: UnsubscribePayload = {
  email_id: "email-001",
  sender_email: "newsletter@example.com",
  list_unsubscribe_url: "https://example.com/unsub",
  list_unsubscribe_mailto: null,
};

// ===========================================================================
// URL paths — routed via /api/emails/:id/:action
// ===========================================================================

describe("endpoint URL paths", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(okJson());
  });

  it("approveDraft PATCHes /api/emails/:id/draft then POSTs /api/emails/:id/send", async () => {
    await approveDraft(approvePayload);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/emails/email-001/draft");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/emails/email-001/send");
  });

  it("rejectDraft posts to /api/emails/:id/reject", async () => {
    await rejectDraft(rejectPayload);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/emails/email-001/reject");
  });

  it("retriage posts to /api/emails/:id/retriage", async () => {
    await retriage(retriagePayload);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/emails/email-001/retriage");
  });

  it("unsubscribe posts to /api/emails/:id/unsubscribe", async () => {
    await unsubscribe(unsubscribePayload);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/emails/email-001/unsubscribe",
    );
  });
});

// ===========================================================================
// Request methods and bodies
// ===========================================================================

describe("request methods and bodies", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(okJson());
  });

  it("approveDraft step 1 PATCHes draft_reply", async () => {
    await approveDraft(approvePayload);
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({
      draft_reply: "Reply",
    });
  });

  it("approveDraft step 2 POSTs send with no body", async () => {
    await approveDraft(approvePayload);
    const opts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(opts.method).toBe("POST");
  });

  it("rejectDraft sends reason in body", async () => {
    await rejectDraft(rejectPayload);
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({
      reason: "Poor quality",
    });
  });

  it("retriage sends payload fields in body", async () => {
    await retriage(retriagePayload);
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({
      sender_email: "sender@example.com",
      subject: "Subject",
      original_category: "SPAM",
    });
  });

  it("unsubscribe sends payload fields in body", async () => {
    await unsubscribe(unsubscribePayload);
    const opts = fetchMock.mock.calls[0][1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({
      sender_email: "newsletter@example.com",
      list_unsubscribe_url: "https://example.com/unsub",
      list_unsubscribe_mailto: null,
    });
  });
});

// ===========================================================================
// Success / failure responses
// ===========================================================================

describe("response handling", () => {
  it("approveDraft resolves with warning when present", async () => {
    fetchMock.mockResolvedValue(
      okJson({ message: "sent", warning: "Placeholders detected" }),
    );
    const result = await approveDraft(approvePayload);
    expect(result).toEqual({ warning: "Placeholders detected" });
  });

  it("approveDraft resolves without warning when absent", async () => {
    fetchMock.mockResolvedValue(okJson({ message: "sent" }));
    const result = await approveDraft(approvePayload);
    expect(result).toEqual({ warning: undefined });
  });

  it("approveDraft throws if PATCH (step 1) fails", async () => {
    fetchMock.mockResolvedValueOnce(failJson(400, { error: "Invalid draft" }));
    await expect(approveDraft(approvePayload)).rejects.toThrow(WebhookError);
    // Only one fetch call — step 2 should not run
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("approveDraft throws if POST send (step 2) fails", async () => {
    fetchMock
      .mockResolvedValueOnce(okJson())
      .mockResolvedValueOnce(failJson(422, { error: "Placeholders remain" }));
    await expect(approveDraft(approvePayload)).rejects.toThrow(WebhookError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejectDraft throws WebhookError on failure", async () => {
    fetchMock.mockResolvedValue(failJson(400, { error: "Bad request" }));
    await expect(rejectDraft(rejectPayload)).rejects.toThrow(WebhookError);
  });

  it("retriage throws WebhookError with correct properties on 500", async () => {
    fetchMock.mockResolvedValue(failJson(500));
    try {
      await retriage(retriagePayload);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookError);
      const webhookErr = err as WebhookError;
      expect(webhookErr.status).toBe(500);
      expect(webhookErr.endpoint).toBe("/api/emails/email-001/retriage");
    }
  });

  it("unsubscribe throws user-friendly message on 501", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 501 });
    try {
      await unsubscribe(unsubscribePayload);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookError);
      const webhookErr = err as WebhookError;
      expect(webhookErr.status).toBe(501);
      expect(webhookErr.message).toContain("noch nicht verfügbar");
    }
  });

  it("unsubscribe throws WebhookError on non-501 failure", async () => {
    fetchMock.mockResolvedValue(failJson(422));
    await expect(unsubscribe(unsubscribePayload)).rejects.toThrow(WebhookError);
  });
});

// ===========================================================================
// WebhookError properties
// ===========================================================================

describe("WebhookError", () => {
  it("has correct name property", () => {
    const err = new WebhookError("test", 500, "/test");
    expect(err.name).toBe("WebhookError");
  });

  it("has status and endpoint properties", () => {
    const err = new WebhookError("test", 404, "/approve-draft");
    expect(err.status).toBe(404);
    expect(err.endpoint).toBe("/approve-draft");
  });

  it("extends Error", () => {
    const err = new WebhookError("test message", 500, "/test");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("test message");
  });
});
