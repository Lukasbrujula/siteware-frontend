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
};

// ===========================================================================
// URL paths — now proxied via /api/webhooks/[action]
// ===========================================================================

describe("webhook URL paths", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true });
  });

  it("approveDraft posts to /api/webhooks/approve", async () => {
    await approveDraft(approvePayload);
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("/api/webhooks/approve");
  });

  it("rejectDraft posts to /api/webhooks/reject", async () => {
    await rejectDraft(rejectPayload);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("/api/webhooks/reject");
  });

  it("retriage posts to /api/webhooks/retriage", async () => {
    await retriage(retriagePayload);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("/api/webhooks/retriage");
  });

  it("unsubscribe posts to /api/webhooks/unsubscribe", async () => {
    await unsubscribe(unsubscribePayload);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("/api/webhooks/unsubscribe");
  });
});

// ===========================================================================
// JSON body
// ===========================================================================

describe("webhook JSON body", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue({ ok: true });
  });

  it("sends correct JSON body for approveDraft", async () => {
    await approveDraft(approvePayload);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(options.body as string)).toEqual(approvePayload);
  });

  it("sends correct JSON body for retriage", async () => {
    await retriage(retriagePayload);
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(options.body as string)).toEqual(retriagePayload);
  });
});

// ===========================================================================
// Success / failure responses
// ===========================================================================

describe("webhook response handling", () => {
  it("resolves on 200 response", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    await expect(approveDraft(approvePayload)).resolves.toBeUndefined();
  });

  it("throws WebhookError on 400 response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400 });
    await expect(rejectDraft(rejectPayload)).rejects.toThrow(WebhookError);
  });

  it("throws WebhookError on 500 response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    try {
      await retriage(retriagePayload);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookError);
      const webhookErr = err as WebhookError;
      expect(webhookErr.status).toBe(500);
      expect(webhookErr.endpoint).toBe("retriage");
    }
  });

  it("throws WebhookError on 422 response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422 });
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
