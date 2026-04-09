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

async function fetchAndMap(): Promise<Record<string, unknown[]> | null> {
  try {
    const response = await fetch(EMAILS_URL, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return null;

    const json = (await response.json()) as Record<string, unknown>;
    if (json.success === false) return null;

    const payload = json.data ?? json;
    return mapBackendResponse(payload);
  } catch {
    return null;
  }
}

async function hydrateFromApi(): Promise<void> {
  const mapped = await fetchAndMap();
  if (mapped) {
    useEmailStore.getState().hydrateFromServer(mapped);
  }
}

async function pollForUpdates(): Promise<boolean> {
  const mapped = await fetchAndMap();
  if (!mapped) return false;
  return useEmailStore.getState().mergeFromServer(mapped);
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
