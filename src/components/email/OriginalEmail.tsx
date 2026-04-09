import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DraftEmail } from "@/types/email";

type OriginalEmailProps = {
  readonly email: DraftEmail;
};

function cleanEmailPreview(raw: string): string {
  let text = raw;

  // Decode quoted-printable soft line breaks
  text = text.replace(/=\r?\n/g, "");

  // Decode quoted-printable encoded characters (e.g. =3D → =, =20 → space)
  text = text.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );

  // Strip MIME boundary markers (lines starting with --)
  text = text.replace(/^--[^\n]*$/gm, "");

  // Strip MIME headers (Content-Type, Content-Transfer-Encoding, charset, etc.)
  text = text.replace(
    /^(Content-Type|Content-Transfer-Encoding|Content-Disposition|MIME-Version|charset)\b[^\n]*/gim,
    "",
  );

  // Strip HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Collapse excessive whitespace
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

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

export function OriginalEmail({ email }: OriginalEmailProps) {
  const rawContent = email.body_plain ?? email.original_preview;
  const cleanPreview = useMemo(
    () => cleanEmailPreview(rawContent),
    [rawContent],
  );

  return (
    <Card className="py-4">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm">Originalmail</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">{email.sender_name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatDate(email.date)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {email.sender_email}
          </span>
        </div>
        <div>
          <h4 className="text-sm font-medium">{email.original_subject}</h4>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {cleanPreview}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
