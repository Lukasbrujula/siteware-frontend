import { useEmailStore } from "@/lib/store/email-store";

type RawEmail = Record<string, unknown>;

function mapBackendEmail(raw: RawEmail): RawEmail {
  const fromAddress = (raw.from_address as string) ?? "";
  const senderEmail =
    (fromAddress || (raw.sender_email as string | undefined)) ?? "";
  const senderName =
    (raw.sender_name as string | undefined) ?? senderEmail.split("@")[0] ?? "";
  const senderDomain = senderEmail.includes("@")
    ? senderEmail.split("@")[1]
    : "";

  return {
    ...raw,
    email_id: raw.email_id ?? raw.id,
    sender_email: senderEmail,
    sender_name: senderName,
    sender_domain: senderDomain,
    body_plain: raw.body_plain ?? raw.body,
    category: raw.category ?? raw.classification,
    date: raw.date ?? raw.received_at,
    timestamp: raw.timestamp ?? raw.received_at,
  };
}

export function mapBackendResponse(
  data: Record<string, unknown[]>,
): Record<string, unknown[]> {
  console.log(
    "[mapBackendResponse] input keys:",
    Object.keys(data),
    "raw data:",
    data,
  );
  try {
    const result: Record<string, unknown[]> = {};
    for (const [key, emails] of Object.entries(data)) {
      result[key] = Array.isArray(emails)
        ? emails.map((e) =>
            typeof e === "object" && e !== null
              ? mapBackendEmail(e as RawEmail)
              : e,
          )
        : emails;
    }
    console.log(
      "[mapBackendResponse] output keys:",
      Object.keys(result),
      "mapped data:",
      result,
    );
    return result;
  } catch (error) {
    console.error("[mapBackendResponse] mapping failed:", error);
    return data;
  }
}

export async function refreshStoreFromServer(): Promise<void> {
  const response = await fetch("/api/emails", {
    headers: { "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return;

  const json = (await response.json()) as {
    success: boolean;
    data: Record<string, unknown[]>;
  };
  if (!json.success) return;

  useEmailStore.getState().hydrateFromServer(mapBackendResponse(json.data));
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
  const url = `/api/email/${encodeURIComponent(emailId)}`;

  const response = await fetch(url, {
    method: "DELETE",
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

export async function updateEmailStatus(
  emailId: string,
  payload: UpdateEmailStatusPayload,
): Promise<void> {
  const url = `/api/email/${encodeURIComponent(emailId)}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new ServerApiError(
      `Status-Update fehlgeschlagen (HTTP ${response.status})`,
      response.status,
      url,
    );
  }
}
