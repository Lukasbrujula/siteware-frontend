import type { Response } from "express";
import { randomUUID } from "node:crypto";

type SseClient = {
  readonly id: string;
  readonly res: Response;
  readonly heartbeat: ReturnType<typeof setInterval>;
};

export type SseEventType = "email:new" | "email:deleted" | "email:updated";

export type SseEvent = {
  readonly type: SseEventType;
  readonly data: Record<string, unknown>;
};

const MAX_CLIENTS = 50;
const HEARTBEAT_INTERVAL_MS = 30_000;

let clients: readonly SseClient[] = [];

export function addClient(res: Response): string | null {
  if (clients.length >= MAX_CLIENTS) {
    return null;
  }

  const id = randomUUID();

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
      removeClient(id);
    }
  }, HEARTBEAT_INTERVAL_MS);

  clients = [...clients, { id, res, heartbeat }];

  res.on("close", () => {
    clearInterval(heartbeat);
    removeClient(id);
  });

  return id;
}

function removeClient(id: string): void {
  clients = clients.filter((c) => c.id !== id);
}

export function broadcast(event: SseEvent): void {
  const payload = JSON.stringify({ type: event.type, ...event.data });
  const deadClientIds: string[] = [];

  for (const client of clients) {
    try {
      const ok = client.res.write(`event: email\ndata: ${payload}\n\n`);
      if (!ok) {
        deadClientIds.push(client.id);
      }
    } catch {
      deadClientIds.push(client.id);
    }
  }

  for (const id of deadClientIds) {
    removeClient(id);
  }
}

export function getClientCount(): number {
  return clients.length;
}

export function __resetClientsForTest(): void {
  for (const client of clients) {
    clearInterval(client.heartbeat);
  }
  clients = [];
}
