import { useEmailStore } from "@/lib/store/email-store";

type RawEmail = Record<string, unknown>;

const CATEGORY_KEYS = new Set([
  "spam",
  "ad",
  "urgent",
  "other",
  "escalation",
  "unsubscribe",
]);

/**
 * Convert a value that might be a Unix-seconds integer, a millisecond timestamp,
 * or an ISO string into a valid ISO date string.
 */
function toIsoDate(value: unknown): string {
  if (value == null) return new Date().toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const num = Number(value);
  if (!isNaN(num) && num > 0) {
    // Unix seconds are < 10_000_000_000; milliseconds are >= that threshold
    const ms = num < 10_000_000_000 ? num * 1000 : num;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

function mapBackendEmail(raw: RawEmail): RawEmail {
  const fromAddress = (raw.from_address as string) ?? "";
  const senderEmail =
    (fromAddress || (raw.sender_email as string | undefined)) ?? "";
  const senderName =
    (raw.sender_name as string | undefined) ?? senderEmail.split("@")[0] ?? "";
  const senderDomain = senderEmail.includes("@")
    ? senderEmail.split("@")[1]
    : "";

  const draftPlain =
    (raw.draft_plain as string | undefined) ??
    (raw.draft_reply as string | undefined) ??
    (raw.draft_text as string | undefined) ??
    (raw.draft_content as string | undefined) ??
    "";
  const draftHtml =
    (raw.draft_html as string | undefined) ??
    (raw.draft_body as string | undefined) ??
    draftPlain;
  const originalPreview =
    (raw.original_preview as string | undefined) ??
    (raw.preview as string | undefined) ??
    (raw.snippet as string | undefined) ??
    "";
  const originalSubject =
    (raw.original_subject as string | undefined) ??
    (raw.subject as string | undefined) ??
    "";

  // Map string urgency ("low"/"normal"/"high"/"critical") to numeric (1-5)
  const urgencyMap: Record<string, number> = {
    low: 1,
    normal: 2,
    high: 3,
    critical: 5,
  };
  const rawUrgency = raw.urgency;
  const urgency =
    typeof rawUrgency === "number"
      ? rawUrgency
      : typeof rawUrgency === "string"
        ? (urgencyMap[rawUrgency.toLowerCase()] ?? 2)
        : 2;

  // Map string sentiment to numeric score (-1 to 1)
  const sentimentMap: Record<string, number> = {
    hostile: -1,
    negative: -0.5,
    neutral: 0,
    positive: 0.5,
  };
  const rawSentiment = raw.sentiment as string | undefined;
  const sentimentScore =
    typeof raw.sentiment_score === "number"
      ? raw.sentiment_score
      : typeof rawSentiment === "string"
        ? (sentimentMap[rawSentiment.toLowerCase()] ?? 0)
        : 0;

  return {
    ...raw,
    email_id: raw.email_id ?? raw.id,
    sender_email: senderEmail,
    sender_name: senderName,
    sender_domain: senderDomain,
    body_plain: raw.body_plain ?? raw.body ?? "",
    category: raw.category ?? raw.classification,
    date: toIsoDate(raw.date ?? raw.received_at),
    timestamp: toIsoDate(raw.timestamp ?? raw.received_at),
    draft_plain: draftPlain,
    draft_html: draftHtml,
    original_preview: originalPreview,
    original_subject: originalSubject,
    subject: (raw.subject as string | undefined) ?? originalSubject,
    confidence: raw.confidence ?? raw.score ?? 0,
    reply_language: raw.reply_language ?? raw.language ?? "de",
    placeholders: raw.placeholders ?? [],
    is_escalated: raw.is_escalated ?? false,
    sentiment_score: sentimentScore,
    review_reason: raw.review_reason ?? "",
    urgency,
    complaint_risk: raw.complaint_risk ?? false,
    legal_threat: raw.legal_threat ?? false,
    churn_risk: raw.churn_risk ?? "low",
    summary:
      (raw.summary as string | undefined) ??
      (raw.escalation_reason as string | undefined) ??
      "",
    escalation_reason: raw.escalation_reason ?? "",
  };
}

/**
 * If the backend returns a flat array of emails (each with a classification/category field),
 * group them into the category-keyed shape the store expects.
 */
function groupFlatArray(
  emails: readonly RawEmail[],
): Record<string, unknown[]> {
  const grouped: Record<string, unknown[]> = {};
  for (const email of emails) {
    const cat = (
      (email.classification as string) ??
      (email.category as string) ??
      ""
    )
      .toLowerCase()
      .replace("unsub", "unsubscribe");
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(email);
  }
  return grouped;
}

/**
 * Normalise whatever shape the backend returns into
 * `{ spam: [...], ad: [...], urgent: [...], other: [...], escalation: [...], unsubscribe: [...] }`.
 */
function normaliseResponseData(raw: unknown): Record<string, unknown[]> {
  // Already grouped by category keys
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const lowerKeys = Object.keys(obj).map((k) => k.toLowerCase());
    const hasCategoryKeys = lowerKeys.some((k) => CATEGORY_KEYS.has(k));
    if (hasCategoryKeys) {
      // Looks like { SPAM: [...], OTHER: [...] } or { spam: [...], other: [...] }
      const result: Record<string, unknown[]> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key.toLowerCase()] = Array.isArray(value) ? value : [];
      }
      return result;
    }

    // Might be { emails: [...] } or { data: [...] } — look for nested array
    for (const value of Object.values(obj)) {
      if (
        Array.isArray(value) &&
        value.length > 0 &&
        typeof value[0] === "object"
      ) {
        return groupFlatArray(value as RawEmail[]);
      }
    }
  }

  // Flat array at top level
  if (Array.isArray(raw)) {
    return groupFlatArray(raw as RawEmail[]);
  }

  return {};
}

export function mapBackendResponse(data: unknown): Record<string, unknown[]> {
  const normalised = normaliseResponseData(data);
  const result: Record<string, unknown[]> = {};
  for (const [key, emails] of Object.entries(normalised)) {
    result[key] = Array.isArray(emails)
      ? emails.map((e) =>
          typeof e === "object" && e !== null
            ? mapBackendEmail(e as RawEmail)
            : e,
        )
      : [];
  }
  return result;
}

export async function refreshStoreFromServer(): Promise<void> {
  const response = await fetch("/api/emails", {
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return;

  const json = (await response.json()) as Record<string, unknown>;

  // Accept { success: true, data: ... } or just { data: ... } or raw data
  const payload = json.data ?? json;
  if (json.success === false) return;

  useEmailStore.getState().hydrateFromServer(mapBackendResponse(payload));
}

export class ServerApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = "ServerApiError";
    this.status = status;
    this.endpoint = endpoint;
  }
}

export async function deleteEmailFromServer(emailId: string): Promise<void> {
  const url = `/api/emails/${encodeURIComponent(emailId)}/archive`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new ServerApiError(
      `Löschen fehlgeschlagen (HTTP ${response.status})`,
      response.status,
      url,
    );
  }
}

export type UpdateEmailStatusPayload = {
  readonly status: "approved" | "rejected" | "assigned" | "pending" | "sent";
  readonly assignee?: string;
};

/**
 * No-op — the primary action routes (send, reject, archive) already set
 * the correct status on the backend. This function exists only to satisfy
 * existing call sites that invoke it as a best-effort follow-up.
 */
export async function updateEmailStatus(
  _emailId: string,
  _payload: UpdateEmailStatusPayload,
): Promise<void> {
  // Intentionally empty — action endpoints handle status transitions.
}
