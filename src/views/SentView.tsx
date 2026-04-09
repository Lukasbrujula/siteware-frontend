import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Inbox, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEmailStore } from "@/lib/store/email-store";
import type { SentEmail } from "@/types/email";

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

function ExpandedSentRow({ email }: { readonly email: SentEmail }) {
  return (
    <TableRow>
      <TableCell colSpan={5} className="bg-muted/30 px-6 py-4">
        <div className="flex flex-col gap-3">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Gesendeter Text
            </span>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {email.draft_plain}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>E-Mail: {email.sender_email}</span>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function SentView() {
  const emails = useEmailStore((state) => state.sent);
  const setSentEmails = useEmailStore((state) => state.setSentEmails);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (hasFetched) return;

    setIsLoading(true);
    fetch("/api/emails/sent", {
      signal: AbortSignal.timeout(10_000),
    })
      .then((res) => res.json())
      .then((json: { success: boolean; data?: SentEmail[] }) => {
        if (json.success && json.data) {
          setSentEmails(json.data);
        }
      })
      .catch(() => {
        // Silent fail — sent tab is informational
      })
      .finally(() => {
        setIsLoading(false);
        setHasFetched(true);
      });
  }, [hasFetched, setSentEmails]);

  const handleToggleExpand = useCallback((emailId: string) => {
    setExpandedId((prev) => (prev === emailId ? null : emailId));
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gesendet</CardTitle>
          <CardDescription>Lade gesendete E-Mails...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gesendet</CardTitle>
        <CardDescription>
          {emails.length === 0
            ? "Keine gesendeten E-Mails vorhanden"
            : `${emails.length} ${emails.length === 1 ? "E-Mail" : "E-Mails"} gesendet`}
        </CardDescription>
      </CardHeader>
      {emails.length > 0 ? (
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Absender</TableHead>
                <TableHead>Betreff</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((email) => {
                const isExpanded = expandedId === email.email_id;
                return (
                  <SentEmailRowGroup
                    key={email.email_id}
                    email={email}
                    isExpanded={isExpanded}
                    onToggleExpand={handleToggleExpand}
                  />
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      ) : (
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="size-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground">
              Keine gesendeten E-Mails vorhanden
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

type SentEmailRowGroupProps = {
  readonly email: SentEmail;
  readonly isExpanded: boolean;
  readonly onToggleExpand: (emailId: string) => void;
};

function SentEmailRowGroup({
  email,
  isExpanded,
  onToggleExpand,
}: SentEmailRowGroupProps) {
  const handleRowClick = useCallback(() => {
    onToggleExpand(email.email_id);
  }, [onToggleExpand, email.email_id]);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={handleRowClick}>
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
              {email.sender_email}
            </span>
          </div>
        </TableCell>
        <TableCell className="max-w-xs truncate">{email.subject}</TableCell>
        <TableCell className="text-muted-foreground">
          {formatDate(email.timestamp)}
        </TableCell>
        <TableCell>
          <Badge variant="secondary">Genehmigt</Badge>
        </TableCell>
      </TableRow>
      {isExpanded ? <ExpandedSentRow email={email} /> : null}
    </>
  );
}
