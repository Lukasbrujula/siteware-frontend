import { useEffect, useRef, useState } from "react";
import { useEmailStore } from "@/lib/store/email-store";
import { mapBackendResponse } from "@/lib/api/emails";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

type DataStreamState = {
  readonly status: ConnectionStatus;
  readonly isSyncing: boolean;
};

type DataStreamOptions = {
  readonly enabled?: boolean;
};

const EMAILS_URL = "/api/emails";
const POLL_INTERVAL_MS = 20_000;
const MAX_STALE_POLLS = 15; // 15 × 20s = 5 min
const SYNC_INDICATOR_MS = 60_000;

type ApiResponse = {
  success: boolean;
  data: Record<string, unknown[]>;
};

async function fetchEmails(): Promise<ApiResponse | null> {
  try {
    const response = await fetch(EMAILS_URL, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return null;

    const json = (await response.json()) as ApiResponse;
    return json.success ? json : null;
  } catch {
    return null;
  }
}

async function hydrateFromApi(): Promise<void> {
  console.log("[hydrateFromApi] called");
  const json = await fetchEmails();
  if (json) {
    useEmailStore.getState().hydrateFromServer(mapBackendResponse(json.data));
  }
}

async function pollForUpdates(): Promise<boolean> {
  const json = await fetchEmails();
  if (!json) return false;
  return useEmailStore
    .getState()
    .mergeFromServer(mapBackendResponse(json.data));
}

export function useDataStream(
  options: DataStreamOptions = {},
): DataStreamState {
  const { enabled = true } = options;
  const [status, setStatus] = useState<ConnectionStatus>(
    enabled ? "connecting" : "disconnected",
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const staleCountRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void hydrateFromApi();

    const startTime = Date.now();
    staleCountRef.current = 0;
    setIsSyncing(true);
    setStatus("connected");

    const pollInterval = setInterval(() => {
      void pollForUpdates().then((hasNew) => {
        if (hasNew) {
          staleCountRef.current = 0;
        } else {
          staleCountRef.current += 1;
        }

        if (Date.now() - startTime > SYNC_INDICATOR_MS) {
          setIsSyncing(false);
        }

        if (staleCountRef.current >= MAX_STALE_POLLS) {
          clearInterval(pollInterval);
          setIsSyncing(false);
          setStatus("disconnected");
        }
      });
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(pollInterval);
      setIsSyncing(false);
      setStatus("connecting");
    };
  }, [enabled]);

  return { status, isSyncing };
}
