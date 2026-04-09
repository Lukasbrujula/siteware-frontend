import { useCallback, useEffect, useState } from "react";
import { DraftList } from "@/components/email/DraftList";
import { OriginalEmail } from "@/components/email/OriginalEmail";
import { DraftEditor } from "@/components/email/DraftEditor";
import { useEmailStore } from "@/lib/store/email-store";
import { useUiStore } from "@/lib/store/ui-store";
import { approveDraft, rejectDraft } from "@/lib/api/webhooks";
import { updateEmailStatus } from "@/lib/api/emails";
import { emitAuditEvent } from "@/lib/api/audit";
import type { DraftEmail } from "@/types/email";
import { toast } from "sonner";

type DraftReviewViewProps = {
  readonly title: string;
  readonly slice: "urgent" | "other";
};

function EmptyState({ title }: { readonly title: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60">
        Keine E-Mails zur Prüfung vorhanden
      </p>
    </div>
  );
}

function NoSelectionState() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-muted-foreground">
        E-Mail aus der Liste auswählen, um den Entwurf zu prüfen
      </p>
    </div>
  );
}

export function DraftReviewView({ title, slice }: DraftReviewViewProps) {
  const emails = useEmailStore(
    (state) => state[slice],
  ) as readonly DraftEmail[];
  const removeEmailById = useEmailStore((state) => state.removeEmailById);
  const selectedEmailId = useUiStore((state) => state.selectedEmailId);
  const setSelectedEmailId = useUiStore((state) => state.setSelectedEmailId);
  const draftEditorContent = useUiStore((state) => state.draftEditorContent);
  const setDraftEditorContent = useUiStore(
    (state) => state.setDraftEditorContent,
  );

  const [submittingAction, setSubmittingAction] = useState<
    "approve" | "reject" | null
  >(null);

  const selectedEmail =
    emails.find((e) => e.email_id === selectedEmailId) ?? null;

  // Sync draft content when selecting a new email
  useEffect(() => {
    if (selectedEmail) {
      const draft = selectedEmail.draft_plain;
      const hasSignature =
        /\[SIGNATUR EINFÜGEN\]/i.test(draft) ||
        /^--\s*$/m.test(draft) ||
        /mit freundlichen grüßen/i.test(draft) ||
        /best regards/i.test(draft) ||
        /kind regards/i.test(draft);
      const content = hasSignature
        ? draft
        : `${draft.trimEnd()}\n\n[SIGNATUR EINFÜGEN]`;
      setDraftEditorContent(content);
    }
  }, [selectedEmail?.email_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = useCallback(
    (emailId: string) => {
      setSelectedEmailId(emailId);
    },
    [setSelectedEmailId],
  );

  const handleDraftChange = useCallback(
    (content: string) => {
      setDraftEditorContent(content);
    },
    [setDraftEditorContent],
  );

  const handleApprove = useCallback(
    async (emailId: string, draftContent: string) => {
      const email = emails.find((e) => e.email_id === emailId);
      if (!email) return;

      setSubmittingAction("approve");
      try {
        await approveDraft({
          email_id: emailId,
          draft_html: email.draft_html,
          draft_plain: draftContent,
          sender_email: email.sender_email,
          subject: email.subject,
          reply_language: email.reply_language,
        });
        // Remove immediately — send already happened via /api/email/send
        removeEmailById(emailId);
        // Update server-side status to "sent" (best-effort)
        updateEmailStatus(emailId, { status: "sent" }).catch(() => {
          // Non-critical: local removal already happened
        });
        setSelectedEmailId(null);
        setDraftEditorContent("");
        emitAuditEvent({
          action: "draft_approved",
          email_id: emailId,
          category: slice.toUpperCase(),
          result: "success",
          context: {
            sender_email: email.sender_email,
            subject: email.subject,
            reply_language: email.reply_language,
          },
        });
        toast.success("E-Mail gesendet", {
          description: "Die Antwort wurde erfolgreich versendet.",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unbekannter Fehler";
        emitAuditEvent({
          action: "draft_approved",
          email_id: emailId,
          category: slice.toUpperCase(),
          result: "failure",
          error: message,
        });
        toast.error("Genehmigung fehlgeschlagen", { description: message });
      } finally {
        setSubmittingAction(null);
      }
    },
    [emails, slice, removeEmailById, setSelectedEmailId, setDraftEditorContent],
  );

  const handleReject = useCallback(
    async (emailId: string, reason: string) => {
      setSubmittingAction("reject");
      try {
        await rejectDraft({
          email_id: emailId,
          reason: reason || undefined,
        });
        // Remove immediately — don't wait for SSE
        removeEmailById(emailId);
        // Update server-side status (best-effort)
        updateEmailStatus(emailId, { status: "rejected" }).catch(() => {
          // Non-critical: local removal already happened
        });
        setSelectedEmailId(null);
        setDraftEditorContent("");
        emitAuditEvent({
          action: "draft_rejected",
          email_id: emailId,
          category: slice.toUpperCase(),
          result: "success",
          context: { reason: reason || undefined },
        });
        toast.info("Entwurf abgelehnt", {
          description: reason ? `Grund: ${reason}` : "Ohne Angabe von Gründen.",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unbekannter Fehler";
        emitAuditEvent({
          action: "draft_rejected",
          email_id: emailId,
          category: slice.toUpperCase(),
          result: "failure",
          error: message,
        });
        toast.error("Ablehnung fehlgeschlagen", { description: message });
      } finally {
        setSubmittingAction(null);
      }
    },
    [slice, removeEmailById, setSelectedEmailId, setDraftEditorContent],
  );

  if (emails.length === 0) {
    return <EmptyState title={title} />;
  }

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* Left panel: email list */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {emails.length} {emails.length === 1 ? "Entwurf" : "Entwürfe"} zur
            Prüfung
          </p>
        </div>
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
          <DraftList
            emails={emails}
            selectedEmailId={selectedEmailId}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Right panel: original email + draft editor */}
      <div className="flex flex-col gap-4">
        {selectedEmail ? (
          <>
            <OriginalEmail email={selectedEmail} />
            <DraftEditor
              email={selectedEmail}
              draftContent={draftEditorContent}
              submittingAction={submittingAction}
              onDraftChange={handleDraftChange}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </>
        ) : (
          <NoSelectionState />
        )}
      </div>
    </div>
  );
}
