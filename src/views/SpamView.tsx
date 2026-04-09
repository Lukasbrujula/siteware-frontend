import { useState, useCallback } from "react";
import { Trash2, ArrowRightLeft, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmailTable } from "@/components/email/EmailTable";
import { useEmailStore } from "@/lib/store/email-store";
import { retriage } from "@/lib/api/webhooks";
import {
  deleteEmailFromServer,
  refreshStoreFromServer,
} from "@/lib/api/emails";
import { emitAuditEvent } from "@/lib/api/audit";
import { toast } from "sonner";

export function SpamView() {
  const emails = useEmailStore((state) => state.spam);
  const removeEmail = useEmailStore((state) => state.removeEmail);

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRetriaging, setIsRetriaging] = useState(false);

  const handleToggleSelect = useCallback((emailId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === emails.length) {
        return new Set();
      }
      return new Set(emails.map((e) => e.email_id));
    });
  }, [emails]);

  const handleToggleExpand = useCallback((emailId: string) => {
    setExpandedId((prev) => (prev === emailId ? null : emailId));
  }, []);

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const ids = [...selectedIds];
      const results = await Promise.allSettled(
        ids.map((id) => deleteEmailFromServer(id)),
      );

      const succeededIds: string[] = [];
      results.forEach((result, index) => {
        const emailId = ids[index];
        if (result.status === "fulfilled") {
          succeededIds.push(emailId);
          emitAuditEvent({
            action: "email_deleted",
            email_id: emailId,
            category: "SPAM",
            result: "success",
          });
        } else {
          const message =
            result.reason instanceof Error
              ? result.reason.message
              : "Unbekannter Fehler";
          emitAuditEvent({
            action: "email_deleted",
            email_id: emailId,
            category: "SPAM",
            result: "failure",
            error: message,
          });
        }
      });

      const failedCount = ids.length - succeededIds.length;
      if (succeededIds.length > 0) {
        toast.success(
          `${succeededIds.length} E-Mail${succeededIds.length > 1 ? "s" : ""} gelöscht`,
        );
      }
      if (failedCount > 0) {
        toast.error(
          `${failedCount} E-Mail${failedCount > 1 ? "s" : ""} konnten nicht gelöscht werden`,
        );
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of succeededIds) {
          next.delete(id);
        }
        return next;
      });
      setExpandedId((prev) =>
        prev && succeededIds.includes(prev) ? null : prev,
      );
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds]);

  const handleMoveToInbox = useCallback(async () => {
    const selected = emails.filter((e) => selectedIds.has(e.email_id));
    if (selected.length === 0) return;

    setIsRetriaging(true);
    try {
      const results = await Promise.allSettled(
        selected.map((email) =>
          retriage({
            email_id: email.email_id,
            sender_email: email.sender_email,
            subject: email.subject,
            original_category: email.category,
          }),
        ),
      );

      const succeededIds: string[] = [];
      results.forEach((result, index) => {
        const emailId = selected[index].email_id;
        if (result.status === "fulfilled") {
          succeededIds.push(emailId);
          emitAuditEvent({
            action: "email_retriaged",
            email_id: emailId,
            category: "SPAM",
            result: "success",
          });
        } else {
          const message =
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown error";
          emitAuditEvent({
            action: "email_retriaged",
            email_id: emailId,
            category: "SPAM",
            result: "failure",
            error: message,
          });
        }
      });

      for (const id of succeededIds) {
        removeEmail("spam", id);
      }

      if (succeededIds.length > 0) {
        await refreshStoreFromServer();
      }

      const failedCount = selected.length - succeededIds.length;
      if (succeededIds.length > 0) {
        toast.success(
          `${succeededIds.length} E-Mail${succeededIds.length > 1 ? "s" : ""} zurück in den Posteingang`,
        );
      }
      if (failedCount > 0) {
        toast.error(
          `${failedCount} E-Mail${failedCount > 1 ? "s" : ""} konnten nicht verschoben werden`,
        );
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of succeededIds) {
          next.delete(id);
        }
        return next;
      });
      setExpandedId((prev) =>
        prev && succeededIds.includes(prev) ? null : prev,
      );
    } finally {
      setIsRetriaging(false);
    }
  }, [emails, selectedIds, removeEmail]);

  const selectedCount = selectedIds.size;
  const hasSelection = selectedCount > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Spam</CardTitle>
            <CardDescription>
              {emails.length} {emails.length === 1 ? "E-Mail" : "E-Mails"}{" "}
              erkannt
            </CardDescription>
          </div>
          {hasSelection ? (
            <div className="flex items-center gap-2">
              <span
                className="text-sm text-muted-foreground"
                aria-live="polite"
                aria-atomic="true"
              >
                {selectedCount} ausgewählt
              </span>
              <Button
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteSelected}
              >
                {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Ausgewählte löschen
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isRetriaging}
                onClick={handleMoveToInbox}
              >
                {isRetriaging ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowRightLeft />
                )}
                In Posteingang
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <EmailTable
          emails={emails}
          selectedIds={selectedIds}
          expandedId={expandedId}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleExpand={handleToggleExpand}
          emptyMessage="Kein Spam erkannt"
        />
      </CardContent>
    </Card>
  );
}
