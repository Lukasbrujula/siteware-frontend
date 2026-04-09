import { useEffect, useRef, useState } from "react";
import { useEmailStore } from "@/lib/store/email-store";
import { apiHeaders } from "@/lib/api/headers";
import { getTenantId } from "@/lib/store/auth-store";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

type DataStreamState = {
  readonly status: ConnectionStatus;
  readonly clientId: string | null;
  readonly isSyncing: boolean;
};

type DataStreamOptions = {
  readonly enabled?: boolean;
};

const SSE_URL = "/api/events";
const HYDRATION_URL = "/api/emails";
const POLL_INTERVAL_MS = 20_000;
const MAX_STALE_POLLS = 15; // 15 × 20s = 5 min
const SYNC_INDICATOR_MS = 60_000; // show indicator for 1 min

type SsePayload = {
  readonly type: "email:new" | "email:deleted" | "email:updated";
  readonly [key: string]: unknown;
};

type ApiResponse = {
  success: boolean;
  data: Record<string, unknown[]>;
};

async function fetchEmails(): Promise<ApiResponse | null> {
  try {
    const tenantId = getTenantId();
    const response = await fetch(
      `${HYDRATION_URL}?tenant_id=${encodeURIComponent(tenantId)}`,
      { headers: apiHeaders() },
    );
    if (!response.ok) return null;

    const json = (await response.json()) as ApiResponse;
    return json.success ? json : null;
  } catch {
    return null;
  }
}

async function hydrateFromApi(): Promise<void> {
  const json = await fetchEmails();
  if (json) {
    useEmailStore.getState().hydrateFromServer(json.data);
  }
}

async function pollForUpdates(): Promise<boolean> {
  const json = await fetchEmails();
  if (!json) return false;
  return useEmailStore.getState().mergeFromServer(json.data);
}

export function useDataStream(
  options: DataStreamOptions = {},
): DataStreamState {
  const { enabled = true } = options;
  const [status, setStatus] = useState<ConnectionStatus>(
    enabled ? "connecting" : "disconnected",
  );
  const [clientId, setClientId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const staleCountRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initial hydration (full replace)
    void hydrateFromApi();

    // --- Polling fallback (SSE is a stub on Vercel) ---
    const startTime = Date.now();
    staleCountRef.current = 0;
    setIsSyncing(true);

    const pollInterval = setInterval(() => {
      void pollForUpdates().then((hasNew) => {
        if (hasNew) {
          staleCountRef.current = 0;
        } else {
          staleCountRef.current += 1;
        }

        // Hide sync indicator after 1 minute
        if (Date.now() - startTime > SYNC_INDICATOR_MS) {
          setIsSyncing(false);
        }

        // Stop polling after 5 min of no new emails
        if (staleCountRef.current >= MAX_STALE_POLLS) {
          clearInterval(pollInterval);
          setIsSyncing(false);
        }
      });
    }, POLL_INTERVAL_MS);

    // --- SSE (best-effort, works locally but stub on Vercel) ---
    const { addEmail, removeEmailById, setSentEmails } =
      useEmailStore.getState();
    const eventSource = new EventSource(SSE_URL);

    eventSource.addEventListener("connected", (event: MessageEvent) => {
      try {
        const data: unknown = JSON.parse(event.data as string);
        if (
          typeof data === "object" &&
          data !== null &&
          "clientId" in data &&
          typeof (data as { clientId: unknown }).clientId === "string"
        ) {
          setClientId((data as { clientId: string }).clientId);
        }
      } catch {
        // connection confirmed even without valid clientId
      }
      setStatus("connected");
    });

    eventSource.addEventListener("email", (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data as string) as SsePayload;

        switch (payload.type) {
          case "email:new":
            addEmail(payload as unknown as Parameters<typeof addEmail>[0]);
            break;

          case "email:deleted": {
            const emailId = payload.email_id as string;
            if (emailId) {
              removeEmailById(emailId);
            }
            break;
          }

          case "email:updated":
            // Status updates remove from active view since those emails no longer need user action
            if (
              payload.status === "approved" ||
              payload.status === "rejected"
            ) {
              const emailId = payload.email_id as string;
              if (emailId) {
                removeEmailById(emailId);
              }
            }
            if (payload.status === "sent") {
              const emailId = payload.email_id as string;
              if (emailId) {
                removeEmailById(emailId);
              }
              // Add to sent slice if sent email data is included
              const sentData = payload.sent as
                | Record<string, unknown>
                | undefined;
              if (sentData && typeof sentData.email_id === "string") {
                const currentSent = useEmailStore.getState().sent;
                const alreadyExists = currentSent.some(
                  (e) => e.email_id === sentData.email_id,
                );
                if (!alreadyExists) {
                  setSentEmails([
                    {
                      email_id: sentData.email_id as string,
                      sender_name: (sentData.sender_name as string) ?? "",
                      sender_email: (sentData.sender_email as string) ?? "",
                      subject: (sentData.subject as string) ?? "",
                      draft_plain: (sentData.draft_plain as string) ?? "",
                      timestamp:
                        (sentData.timestamp as string) ??
                        new Date().toISOString(),
                    },
                    ...currentSent,
                  ]);
                }
              }
            }
            break;

          default:
            // Unknown event type — backwards-compatible fallback
            addEmail(payload as unknown as Parameters<typeof addEmail>[0]);
        }
      } catch {
        // skip malformed SSE events
      }
    });

    eventSource.onerror = () => {
      setStatus("error");
    };

    eventSource.onopen = () => {
      setStatus("connected");
    };

    return () => {
      clearInterval(pollInterval);
      eventSource.close();
      setIsSyncing(false);
      setStatus("connecting");
    };
  }, [enabled]);

  return { status, clientId, isSyncing };
}
