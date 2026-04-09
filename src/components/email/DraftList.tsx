import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getConfidenceColor } from "@/lib/draft-helpers";
import type { DraftEmail } from "@/types/email";

type DraftListProps = {
  readonly emails: readonly DraftEmail[];
  readonly selectedEmailId: string | null;
  readonly onSelect: (emailId: string) => void;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConfidenceBadge({ confidence }: { readonly confidence: number }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-mono", getConfidenceColor(confidence))}
    >
      {Math.round(confidence * 100)}%
    </Badge>
  );
}

export function DraftList({
  emails,
  selectedEmailId,
  onSelect,
}: DraftListProps) {
  const sorted = useMemo(
    () =>
      [...emails].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [emails],
  );

  if (emails.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">
          Keine Entwürfe zur Prüfung
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" role="listbox" aria-label="E-Mail-Entwürfe">
      {sorted.map((email) => (
        <button
          key={email.email_id}
          type="button"
          role="option"
          aria-selected={email.email_id === selectedEmailId}
          onClick={() => onSelect(email.email_id)}
          className={cn(
            "flex flex-col gap-1.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent/50",
            email.email_id === selectedEmailId && "bg-accent",
            email.is_escalated && "border-l-2 border-l-red-500",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">
              {email.sender_name}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              {email.is_escalated && (
                <Badge
                  variant="destructive"
                  className="text-[10px] px-1.5 py-0"
                >
                  Eskaliert
                </Badge>
              )}
              <ConfidenceBadge confidence={email.confidence} />
            </div>
          </div>
          <span className="truncate text-sm text-foreground/80">
            {email.subject}
          </span>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {email.sender_email}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDate(email.date)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
