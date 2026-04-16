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

export type ApproveDraftResult = {
  readonly warning?: string;
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

// --- Internal helpers ---

function emailUrl(emailId: string, action: string): string {
  return `/api/emails/${encodeURIComponent(emailId)}/${action}`;
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body.error === "string") return body.error;
  } catch {
    // Response may not be JSON
  }
  return `HTTP ${response.status}`;
}

// --- Public API ---

/**
 * Two-step approve flow:
 * 1. PATCH the (possibly edited) draft text to the backend
 * 2. POST send to trigger the actual email delivery
 */
export async function approveDraft(
  payload: ApproveDraftPayload,
): Promise<ApproveDraftResult> {
  const id = payload.email_id;

  // Step 1: save the edited draft
  const patchUrl = emailUrl(id, "draft");
  const patchResponse = await fetch(patchUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft_reply: payload.draft_plain }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!patchResponse.ok) {
    const detail = await parseErrorDetail(patchResponse);
    throw new WebhookError(
      `Entwurf konnte nicht gespeichert werden: ${detail}`,
      patchResponse.status,
      patchUrl,
    );
  }

  // Step 2: send the email
  const sendUrl = emailUrl(id, "send");
  const sendResponse = await fetch(sendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!sendResponse.ok) {
    const detail = await parseErrorDetail(sendResponse);
    throw new WebhookError(
      `E-Mail-Versand fehlgeschlagen: ${detail}`,
      sendResponse.status,
      sendUrl,
    );
  }

  const result = (await sendResponse.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return {
    warning: typeof result.warning === "string" ? result.warning : undefined,
  };
}

export async function rejectDraft(payload: RejectDraftPayload): Promise<void> {
  const url = emailUrl(payload.email_id, "reject");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: payload.reason }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new WebhookError(
      `Ablehnung fehlgeschlagen: ${detail}`,
      response.status,
      url,
    );
  }
}

export async function retriage(payload: RetriagePayload): Promise<void> {
  const url = emailUrl(payload.email_id, "retriage");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_email: payload.sender_email,
      subject: payload.subject,
      original_category: payload.original_category,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new WebhookError(
      `Verschieben fehlgeschlagen: ${detail}`,
      response.status,
      url,
    );
  }
}

export async function unsubscribe(payload: UnsubscribePayload): Promise<void> {
  const url = emailUrl(payload.email_id, "unsubscribe");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_email: payload.sender_email,
      list_unsubscribe_url: payload.list_unsubscribe_url,
      list_unsubscribe_mailto: payload.list_unsubscribe_mailto,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 501) {
    throw new WebhookError(
      "Automatische Abmeldung ist noch nicht verfügbar. Bitte manuell abmelden.",
      501,
      url,
    );
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new WebhookError(
      `Abmeldung fehlgeschlagen: ${detail}`,
      response.status,
      url,
    );
  }
}
