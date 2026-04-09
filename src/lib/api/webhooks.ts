import { apiHeaders } from "@/lib/api/headers";
import { getTenantId } from "@/lib/store/auth-store";

// --- Payload types ---

export type ApproveDraftPayload = {
  readonly email_id: string;
  readonly draft_html: string;
  readonly draft_plain: string;
  readonly sender_email: string;
  readonly subject: string;
  readonly reply_language: "de" | "en";
};

export type RejectDraftPayload = {
  readonly email_id: string;
  readonly reason?: string;
};

/**
 * Retriage payload is intentionally minimal. The dashboard only receives a
 * 150-char preview from n8n's inbound push — not the full email body
 * (body_plain, body_html, sender_name, sender_domain, etc.).
 *
 * For n8n to re-classify the email properly, it needs to look up the full
 * email body by email_id from its own storage. This is an n8n-side
 * responsibility, not a dashboard limitation.
 */
export type RetriagePayload = {
  readonly email_id: string;
  readonly sender_email: string;
  readonly subject: string;
  readonly original_category: "SPAM" | "AD";
};

export type UnsubscribePayload = {
  readonly email_id: string;
  readonly sender_email: string;
  readonly list_unsubscribe_url?: string | null;
  readonly list_unsubscribe_mailto?: string | null;
};

// --- Error type ---

export class WebhookError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = "WebhookError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

// --- Internal helper ---

async function postWebhook<T extends Record<string, unknown>>(
  action: string,
  payload: T,
): Promise<void> {
  const url = `/api/webhooks/${action}`;

  const response = await fetch(url, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new WebhookError(
      `Webhook fehlgeschlagen (HTTP ${response.status})`,
      response.status,
      action,
    );
  }
}

// --- Public API ---

export async function approveDraft(
  payload: ApproveDraftPayload,
): Promise<void> {
  const url = "/api/email/send";
  const tenantId = getTenantId();

  const response = await fetch(url, {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      tenant_id: tenantId,
      to: payload.sender_email,
      subject: payload.subject,
      body_html: payload.draft_html,
      body_plain: payload.draft_plain,
      email_id: payload.email_id,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail =
      typeof (body as Record<string, unknown>).error === "string"
        ? (body as Record<string, unknown>).error
        : `HTTP ${response.status}`;
    throw new WebhookError(
      `E-Mail-Versand fehlgeschlagen: ${detail}`,
      response.status,
      url,
    );
  }
}

export async function rejectDraft(payload: RejectDraftPayload): Promise<void> {
  await postWebhook("reject", payload);
}

export async function retriage(payload: RetriagePayload): Promise<void> {
  await postWebhook("retriage", payload);
}

export async function unsubscribe(payload: UnsubscribePayload): Promise<void> {
  await postWebhook("unsubscribe", payload);
}
