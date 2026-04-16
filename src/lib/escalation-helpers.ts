import type { EscalationAlert } from "@/types/email";

export function sortBySeverity(a: EscalationAlert, b: EscalationAlert): number {
  const aLegal = a.legal_threat ?? false;
  const bLegal = b.legal_threat ?? false;
  if (aLegal !== bLegal) {
    return aLegal ? -1 : 1;
  }
  return (a.sentiment_score ?? 0) - (b.sentiment_score ?? 0);
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
