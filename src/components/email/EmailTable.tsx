import { useCallback, useMemo } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Inbox } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SpamAdEmail } from "@/types/email";

type EmailTableProps = {
  readonly emails: readonly SpamAdEmail[];
  readonly selectedIds: ReadonlySet<string>;
  readonly expandedId: string | null;
  readonly onToggleSelect: (emailId: string) => void;
  readonly onToggleSelectAll: () => void;
  readonly onToggleExpand: (emailId: string) => void;
  readonly renderRowActions?: (email: SpamAdEmail) => React.ReactNode;
  readonly emptyMessage: string;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ConfidenceBadge({
  confidence,
  lowConfidence,
}: {
  readonly confidence: number;
  readonly lowConfidence: boolean;
}) {
  const percent = Math.round(confidence * 100);

  if (lowConfidence) {
    return (
      <span
        className="inline-flex items-center gap-1"
        title="Niedrige Konfidenz"
        aria-label="Niedrige Konfidenz"
      >
        <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
        <Badge
          variant="outline"
          className="border-amber-300 bg-amber-50 text-amber-700"
        >
          {percent}%
        </Badge>
      </span>
    );
  }

  return <Badge variant="secondary">{percent}%</Badge>;
}

function ExpandedRow({
  email,
  columnCount,
}: {
  readonly email: SpamAdEmail;
  readonly columnCount: number;
}) {
  return (
    <TableRow>
      <TableCell colSpan={columnCount} className="bg-muted/30 px-6 py-4">
        <div className="flex flex-col gap-3">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vorschau
            </span>
            <p className="mt-1 text-sm text-foreground">{email.preview}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Klassifizierungsgrund
            </span>
            <p className="mt-1 text-sm text-foreground">{email.reasoning}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Domain: {email.sender_domain}</span>
            <span>E-Mail: {email.sender_email}</span>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmptyState({ message }: { readonly message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Inbox className="size-12 text-muted-foreground/40" />
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function EmailTable({
  emails,
  selectedIds,
  expandedId,
  onToggleSelect,
  onToggleSelectAll,
  onToggleExpand,
  renderRowActions,
  emptyMessage,
}: EmailTableProps) {
  const allSelected = emails.length > 0 && selectedIds.size === emails.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < emails.length;

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent, emailId: string) => {
      e.stopPropagation();
      onToggleSelect(emailId);
    },
    [onToggleSelect],
  );

  const handleHeaderCheckboxClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleSelectAll();
    },
    [onToggleSelectAll],
  );

  const columnCount = renderRowActions ? 7 : 6;

  const sorted = useMemo(
    () =>
      [...emails].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [emails],
  );

  if (emails.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = someSelected;
                }
              }}
              onClick={handleHeaderCheckboxClick}
              onChange={() => undefined}
              className="size-4 cursor-pointer rounded border-border accent-primary"
              aria-label={allSelected ? "Alle abwählen" : "Alle auswählen"}
            />
          </TableHead>
          <TableHead className="w-6" />
          <TableHead>Absender</TableHead>
          <TableHead>Betreff</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead>Konfidenz</TableHead>
          {renderRowActions ? (
            <TableHead className="text-right">Aktionen</TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((email) => {
          const isSelected = selectedIds.has(email.email_id);
          const isExpanded = expandedId === email.email_id;

          return (
            <EmailRowGroup
              key={email.email_id}
              email={email}
              isSelected={isSelected}
              isExpanded={isExpanded}
              columnCount={columnCount}
              onCheckboxClick={handleCheckboxClick}
              onRowClick={onToggleExpand}
              renderRowActions={renderRowActions}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

type EmailRowGroupProps = {
  readonly email: SpamAdEmail;
  readonly isSelected: boolean;
  readonly isExpanded: boolean;
  readonly columnCount: number;
  readonly onCheckboxClick: (e: React.MouseEvent, emailId: string) => void;
  readonly onRowClick: (emailId: string) => void;
  readonly renderRowActions?: (email: SpamAdEmail) => React.ReactNode;
};

function EmailRowGroup({
  email,
  isSelected,
  isExpanded,
  columnCount,
  onCheckboxClick,
  onRowClick,
  renderRowActions,
}: EmailRowGroupProps) {
  const handleRowClick = useCallback(() => {
    onRowClick(email.email_id);
  }, [onRowClick, email.email_id]);

  const handleCheckbox = useCallback(
    (e: React.MouseEvent) => {
      onCheckboxClick(e, email.email_id);
    },
    [onCheckboxClick, email.email_id],
  );

  const handleActionsCellClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <>
      <TableRow
        className={cn("cursor-pointer", isSelected && "bg-muted/50")}
        data-state={isSelected ? "selected" : undefined}
        onClick={handleRowClick}
      >
        <TableCell>
          <input
            type="checkbox"
            checked={isSelected}
            onClick={handleCheckbox}
            onChange={() => undefined}
            className="size-4 cursor-pointer rounded border-border accent-primary"
            aria-label={`${email.sender_name} auswählen`}
          />
        </TableCell>
        <TableCell className="px-0">
          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-medium">{email.sender_name}</span>
            <span className="text-xs text-muted-foreground">
              {email.sender_domain}
            </span>
          </div>
        </TableCell>
        <TableCell className="max-w-xs truncate">{email.subject}</TableCell>
        <TableCell className="text-muted-foreground">
          {formatDate(email.date)}
        </TableCell>
        <TableCell>
          <ConfidenceBadge
            confidence={email.confidence}
            lowConfidence={email.low_confidence}
          />
        </TableCell>
        {renderRowActions ? (
          <TableCell className="text-right" onClick={handleActionsCellClick}>
            {renderRowActions(email)}
          </TableCell>
        ) : null}
      </TableRow>
      {isExpanded ? (
        <ExpandedRow email={email} columnCount={columnCount} />
      ) : null}
    </>
  );
}
