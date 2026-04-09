import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { UnsubscribeStatusBadge } from "@/components/email/UnsubscribeStatusBadge";
import { UnsubscribeMethodBadge } from "@/components/email/UnsubscribeMethodBadge";
import type { UnsubscribeStatus } from "@/types/email";

type UnsubscribeTableProps = {
  readonly entries: readonly UnsubscribeStatus[];
  readonly retryingIds: ReadonlySet<string>;
  readonly onRetry: (emailId: string) => void;
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function UnsubscribeRow({
  entry,
  isRetrying,
  onRetry,
}: {
  readonly entry: UnsubscribeStatus;
  readonly isRetrying: boolean;
  readonly onRetry: (emailId: string) => void;
}) {
  const handleRetry = useCallback(() => {
    onRetry(entry.email_id);
  }, [entry.email_id, onRetry]);

  return (
    <TableRow>
      <TableCell className="font-medium">{entry.sender}</TableCell>
      <TableCell>
        <UnsubscribeMethodBadge method={entry.unsubscribe_method} />
      </TableCell>
      <TableCell>
        <UnsubscribeStatusBadge status={entry.status} />
      </TableCell>
      <TableCell className="max-w-[300px] truncate text-muted-foreground">
        {entry.reason}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatTimestamp(entry.timestamp)}
      </TableCell>
      <TableCell>
        {entry.status === "nicht erfolgreich" && (
          <Button
            variant="outline"
            size="sm"
            disabled={isRetrying}
            onClick={handleRetry}
          >
            {isRetrying ? <Loader2 className="animate-spin" /> : null}
            Erneut versuchen
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function UnsubscribeTable({
  entries,
  retryingIds,
  onRetry,
}: UnsubscribeTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Absender</TableHead>
          <TableHead>Methode</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Grund</TableHead>
          <TableHead>Zeitpunkt</TableHead>
          <TableHead className="w-[140px]">Aktion</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <UnsubscribeRow
            key={entry.email_id}
            entry={entry}
            isRetrying={retryingIds.has(entry.email_id)}
            onRetry={onRetry}
          />
        ))}
      </TableBody>
    </Table>
  );
}
