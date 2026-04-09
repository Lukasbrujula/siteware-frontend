import { useEmailStore } from "@/lib/store/email-store";
import { apiHeaders } from "@/lib/api/headers";
import { getTenantId } from "@/lib/store/auth-store";

export async function refreshStoreFromServer(): Promise<void> {
  const tenantId = getTenantId();

  const response = await fetch(
    `/api/emails?tenant_id=${encodeURIComponent(tenantId)}`,
    {
      headers: apiHeaders(),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return;

  const json = (await response.json()) as {
    success: boolean;
    data: Record<string, unknown[]>;
  };
  if (!json.success) return;

  useEmailStore.getState().hydrateFromServer(json.data);
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
    headers: apiHeaders(),
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
    headers: apiHeaders({ "Content-Type": "application/json" }),
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
