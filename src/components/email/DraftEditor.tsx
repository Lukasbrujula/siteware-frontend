import { useCallback, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  hasPlaceholders,
  getConfidenceColor,
  buildHighlightedHtml,
} from "@/lib/draft-helpers";
import type { DraftEmail } from "@/types/email";

type DraftEditorProps = {
  readonly email: DraftEmail;
  readonly draftContent: string;
  readonly submittingAction: "approve" | "reject" | null;
  readonly onDraftChange: (content: string) => void;
  readonly onApprove: (
    emailId: string,
    draftContent: string,
  ) => void | Promise<void>;
  readonly onReject: (emailId: string, reason: string) => void | Promise<void>;
};

function HighlightedPreview({ text }: { readonly text: string }) {
  const html = useMemo(() => buildHighlightedHtml(text), [text]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-sm text-transparent"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function DraftEditor({
  email,
  draftContent,
  submittingAction,
  onDraftChange,
  onApprove,
  onReject,
}: DraftEditorProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const placeholdersExist = useMemo(
    () => hasPlaceholders(draftContent),
    [draftContent],
  );

  const handleApprove = useCallback(() => {
    onApprove(email.email_id, draftContent);
  }, [email.email_id, draftContent, onApprove]);

  const handleRejectConfirm = useCallback(async () => {
    await onReject(email.email_id, rejectReason);
    setRejectDialogOpen(false);
    setRejectReason("");
  }, [email.email_id, rejectReason, onReject]);

  const handleRejectCancel = useCallback(() => {
    setRejectDialogOpen(false);
    setRejectReason("");
  }, []);

  return (
    <>
      <Card className={cn("py-4", email.is_escalated && "border-red-500")}>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">KI-Entwurf</CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px] font-mono",
                  getConfidenceColor(email.confidence),
                )}
              >
                Konfidenz: {Math.round(email.confidence * 100)}%
              </Badge>
              {email.is_escalated && (
                <Badge variant="destructive" className="text-[11px]">
                  Eskaliert
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Betreff:
            </span>
            <span className="text-sm">{email.subject}</span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Sprache:
            </span>
            <span className="text-sm">
              {email.reply_language === "de" ? "Deutsch" : "Englisch"}
            </span>
          </div>

          {email.review_reason && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-xs font-medium text-amber-800">
                Prüfungsgrund:
              </span>
              <p className="mt-0.5 text-sm text-amber-700">
                {email.review_reason}
              </p>
            </div>
          )}

          <div className="relative">
            <label htmlFor={`draft-${email.email_id}`} className="sr-only">
              Entwurf bearbeiten
            </label>
            <HighlightedPreview text={draftContent} />
            <textarea
              id={`draft-${email.email_id}`}
              value={draftContent}
              onChange={(e) => onDraftChange(e.target.value)}
              className="relative min-h-48 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              style={{ caretColor: "auto" }}
            />
          </div>

          {placeholdersExist && (
            <div
              className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2"
              role="alert"
            >
              <span className="text-xs font-medium text-yellow-800">
                Platzhalter vorhanden — bitte alle [BITTE ERGÄNZEN: ...] Felder
                ausfüllen
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button
            onClick={handleApprove}
            disabled={placeholdersExist || submittingAction !== null}
            title={
              placeholdersExist
                ? "Platzhalter müssen ausgefüllt werden"
                : "Entwurf genehmigen und senden"
            }
          >
            {submittingAction === "approve" ? (
              <Loader2 className="animate-spin" />
            ) : null}
            Genehmigen & Senden
          </Button>
          <Button
            variant="destructive"
            disabled={submittingAction !== null}
            onClick={() => setRejectDialogOpen(true)}
          >
            Ablehnen
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entwurf ablehnen</DialogTitle>
            <DialogDescription>
              Möchten Sie diesen Entwurf wirklich ablehnen? Sie können optional
              einen Grund angeben.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="reject-reason" className="text-sm font-medium">
              Grund (optional)
            </label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Grund für die Ablehnung..."
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={submittingAction === "reject"}
              onClick={handleRejectCancel}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={submittingAction === "reject"}
              onClick={handleRejectConfirm}
            >
              {submittingAction === "reject" ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
