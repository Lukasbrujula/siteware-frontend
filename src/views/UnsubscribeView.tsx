import { useCallback, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEmailStore } from "@/lib/store/email-store";
import { UnsubscribeTable } from "@/components/email/UnsubscribeTable";
import { unsubscribe } from "@/lib/api/webhooks";
import { emitAuditEvent } from "@/lib/api/audit";
import { toast } from "sonner";

export function UnsubscribeView() {
  const entries = useEmailStore((state) => state.unsubscribes);
  const total = entries.length;
  const failed = useEmailStore(
    (state) =>
      state.unsubscribes.filter((u) => u.status === "nicht erfolgreich").length,
  );

  const [retryingIds, setRetryingIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const handleRetry = useCallback(
    async (emailId: string) => {
      const entry = entries.find((e) => e.email_id === emailId);
      if (!entry) return;

      setRetryingIds((prev) => new Set([...prev, emailId]));
      try {
        await unsubscribe({
          email_id: entry.email_id,
          sender_email: entry.sender,
        });
        emitAuditEvent({
          action: "unsubscribe_retried",
          email_id: emailId,
          category: "UNSUBSCRIBE",
          result: "success",
          context: { sender: entry.sender },
        });
        toast.success("Abmeldung erneut angefordert", {
          description: `${entry.sender} wird erneut versucht.`,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unbekannter Fehler";
        emitAuditEvent({
          action: "unsubscribe_retried",
          email_id: emailId,
          category: "UNSUBSCRIBE",
          result: "failure",
          error: message,
        });
        toast.error("Erneuter Versuch fehlgeschlagen", {
          description: message,
        });
      } finally {
        setRetryingIds((prev) => {
          const next = new Set(prev);
          next.delete(emailId);
          return next;
        });
      }
    },
    [entries],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Abmeldungen</CardTitle>
        <CardDescription>
          {total === 0
            ? "Keine Abmeldungen vorhanden"
            : `${total} gesamt${failed > 0 ? `, ${failed} fehlgeschlagen` : ""}`}
        </CardDescription>
      </CardHeader>
      {total > 0 ? (
        <CardContent>
          <UnsubscribeTable
            entries={entries}
            retryingIds={retryingIds}
            onRetry={handleRetry}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
