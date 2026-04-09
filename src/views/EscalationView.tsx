import type { ChangeEvent } from "react";
import { useMemo, useCallback, useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SentimentBadge } from "@/components/email/SentimentBadge";
import { RiskFlags } from "@/components/email/RiskFlags";
import { useEmailStore } from "@/lib/store/email-store";
import { emitAuditEvent } from "@/lib/api/audit";
import { updateEmailStatus } from "@/lib/api/emails";
import { approveDraft, rejectDraft } from "@/lib/api/webhooks";
import { sortBySeverity, formatTimestamp } from "@/lib/escalation-helpers";
import { toast } from "sonner";
import type { EscalationAlert } from "@/types/email";

function UrgencyBadge({ urgency }: { readonly urgency: number }) {
  const variant =
    urgency >= 4 ? "destructive" : urgency >= 3 ? "default" : "secondary";
  return (
    <Badge variant={variant} className="text-[11px]">
      Dringlichkeit: {urgency}/5
    </Badge>
  );
}

function EscalationCard({ alert }: { readonly alert: EscalationAlert }) {
  const removeEmailById = useEmailStore((s) => s.removeEmailById);

  // Reply editor state
  const [draftContent, setDraftContent] = useState(alert.draft_plain ?? "");
  const [editing, setEditing] = useState(Boolean(alert.draft_plain));
  const [submittingAction, setSubmittingAction] = useState<
    "approve" | "reject" | null
  >(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEdit = useCallback(() => {
    setEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const handleApprove = useCallback(async () => {
    if (draftContent.trim() === "") {
      toast.error("Antwort ist leer", {
        description: "Bitte schreiben Sie eine Antwort.",
      });
      return;
    }

    setSubmittingAction("approve");
    try {
      await approveDraft({
        email_id: alert.email_id,
        draft_html: `<p>${draftContent.replace(/\n/g, "<br>")}</p>`,
        draft_plain: draftContent,
        sender_email: alert.sender_email,
        subject: `Re: ${alert.subject}`,
        reply_language: "de",
      });

      // Remove immediately — don't wait for SSE
      removeEmailById(alert.email_id);
      // Update server-side status (best-effort)
      updateEmailStatus(alert.email_id, { status: "approved" }).catch(() => {
        // Non-critical: local removal already happened
      });

      emitAuditEvent({
        action: "draft_approved",
        email_id: alert.email_id,
        category: "ESCALATION",
        result: "success",
      });
      toast.success("Antwort gesendet");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      emitAuditEvent({
        action: "draft_approved",
        email_id: alert.email_id,
        category: "ESCALATION",
        result: "failure",
        error: message,
      });
      toast.error("Senden fehlgeschlagen", { description: message });
    } finally {
      setSubmittingAction(null);
    }
  }, [alert, draftContent, removeEmailById]);

  const handleReject = useCallback(async () => {
    setRejectDialogOpen(false);
    setSubmittingAction("reject");
    try {
      await rejectDraft({
        email_id: alert.email_id,
        reason: rejectReason || undefined,
      });

      // Remove immediately — don't wait for SSE
      removeEmailById(alert.email_id);
      // Update server-side status (best-effort)
      updateEmailStatus(alert.email_id, { status: "rejected" }).catch(() => {
        // Non-critical: local removal already happened
      });

      emitAuditEvent({
        action: "draft_rejected",
        email_id: alert.email_id,
        category: "ESCALATION",
        result: "success",
      });
      toast.success("Eskalation abgelehnt");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unbekannter Fehler";
      emitAuditEvent({
        action: "draft_rejected",
        email_id: alert.email_id,
        category: "ESCALATION",
        result: "failure",
        error: message,
      });
      toast.error("Ablehnen fehlgeschlagen", { description: message });
    } finally {
      setSubmittingAction(null);
      setRejectReason("");
    }
  }, [alert.email_id, rejectReason, removeEmailById]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-base">{alert.subject}</CardTitle>
            <CardDescription>
              {alert.sender_name} &lt;{alert.sender_email}&gt;
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <UrgencyBadge urgency={alert.urgency} />
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(alert.timestamp)}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <SentimentBadge score={alert.sentiment_score} />

        <RiskFlags
          complaintRisk={alert.complaint_risk}
          legalThreat={alert.legal_threat}
          churnRisk={alert.churn_risk}
        />

        {(alert.body_plain ?? alert.preview) && (
          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Originalmail
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {alert.body_plain ?? alert.preview}
            </p>
          </div>
        )}

        <div className="rounded-md border border-border bg-muted/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Zusammenfassung
          </p>
          <p className="mt-1 text-sm">{alert.summary}</p>
        </div>

        {/* Reply editor */}
        <div className="space-y-3 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Antwort</p>
            {!editing && (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                Bearbeiten
              </Button>
            )}
          </div>

          <Textarea
            ref={textareaRef}
            className="min-h-[120px] resize-y bg-background text-sm"
            placeholder="Antwort verfassen…"
            value={draftContent}
            readOnly={!editing}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setDraftContent(e.target.value)
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={submittingAction !== null || draftContent.trim() === ""}
              onClick={handleApprove}
            >
              {submittingAction === "approve"
                ? "Wird gesendet…"
                : "Genehmigen & Senden"}
            </Button>

            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submittingAction !== null}
                >
                  Ablehnen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Eskalation ablehnen</DialogTitle>
                  <DialogDescription>
                    Optional: Geben Sie einen Grund für die Ablehnung an.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder="Grund (optional)"
                  value={rejectReason}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                    setRejectReason(e.target.value)
                  }
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setRejectDialogOpen(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={submittingAction !== null}
                    onClick={handleReject}
                  >
                    {submittingAction === "reject"
                      ? "Wird abgelehnt…"
                      : "Ablehnen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EscalationView() {
  const escalations = useEmailStore((state) => state.escalations);

  const sorted = useMemo(
    () => [...escalations].sort(sortBySeverity),
    [escalations],
  );

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Eskalation</CardTitle>
          <CardDescription>Keine aktiven Eskalationen</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Eskalation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "Warnung" : "Warnungen"} aktiv
        </p>
      </div>

      <div className="grid gap-4">
        {sorted.map((alert) => (
          <EscalationCard key={alert.email_id} alert={alert} />
        ))}
      </div>
    </div>
  );
}
