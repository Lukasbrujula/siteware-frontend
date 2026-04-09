import type { AuditEvent } from "@/types/audit";
import { apiHeaders } from "@/lib/api/headers";

export function emitAuditEvent(event: AuditEvent): void {
  try {
    fetch("/api/email/audit", {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5_000),
    }).catch(() => {
      // Silently ignore — audit must never affect UX
    });
  } catch {
    // Silently ignore — audit must never affect UX
  }
}
