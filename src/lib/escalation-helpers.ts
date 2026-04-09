import type { EscalationAlert } from "@/types/email";

export function sortBySeverity(a: EscalationAlert, b: EscalationAlert): number {
  if (a.legal_threat !== b.legal_threat) {
    return a.legal_threat ? -1 : 1;
  }
  return a.sentiment_score - b.sentiment_score;
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
