import { ImapFlow } from "imapflow";
import type { FetchMessageObject } from "imapflow";

const N8N_TRIAGE_URL = "https://siteware.app.n8n.cloud/webhook/email-inbound";
const BACKFILL_DAYS = 3;
const MAX_EMAILS = 20;
const CONNECTION_TIMEOUT_MS = 30_000;
const WEBHOOK_TIMEOUT_MS = 10_000;

export type BackfillConfig = {
  readonly tenantId: string;
  readonly imapHost: string;
  readonly imapPort: number;
  readonly imapUser: string;
  readonly imapPassword: string;
};

export type BackfillResult = {
  readonly fetched: number;
  readonly sent: number;
  readonly errors: number;
};

type ParsedEmail = {
  readonly tenant_id: string;
  readonly messageId: string;
  readonly from: string;
  readonly subject: string;
  readonly body: string;
  readonly date: string;
  readonly sender_name: string;
  readonly sender_email: string;
  readonly body_plain: string;
  readonly body_html: string;
  readonly received_at: string;
  readonly has_attachments: boolean;
};

/**
 * Backfill a tenant's INBOX by fetching the last few days of emails
 * (including already-read ones) and forwarding them to the n8n triage
 * webhook — the same pipeline the poller uses.
 *
 * This runs once after onboarding so the tenant sees data immediately
 * instead of waiting for the next poller cycle.
 */
export async function backfillInbox(
  config: BackfillConfig,
): Promise<BackfillResult> {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: true,
    auth: {
      user: config.imapUser,
      pass: config.imapPassword,
    },
    logger: false,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const since = new Date();
      since.setDate(since.getDate() - BACKFILL_DAYS);

      // Fetch ALL emails (read + unread) from the last N days
      // ImapFlow search() can return false on failure — coerce to empty array
      const sinceResult = await client.search({ since }, { uid: true });
      let uids: number[] = Array.isArray(sinceResult) ? sinceResult : [];

      // Gmail SEARCH SINCE can be unreliable — fall back to ALL if too few
      if (uids.length < MAX_EMAILS) {
        const allResult = await client.search({ all: true }, { uid: true });
        const allUids = Array.isArray(allResult) ? allResult : [];
        if (allUids.length > uids.length) {
          uids = allUids;
        }
      }

      if (uids.length === 0) {
        return { fetched: 0, sent: 0, errors: 0 };
      }

      // Take the most recent N emails (highest UIDs = newest)
      const sortedUids = [...uids].sort((a, b) => b - a).slice(0, MAX_EMAILS);

      const messages = client.fetch(
        sortedUids.join(","),
        { uid: true, envelope: true, source: true, bodyStructure: true },
        { uid: true },
      );

      const parsed: ParsedEmail[] = [];
      for await (const msg of messages) {
        parsed.push(parseMessage(msg, config.tenantId));
      }

      // Sort newest first
      parsed.sort(
        (a, b) =>
          new Date(b.received_at).getTime() - new Date(a.received_at).getTime(),
      );

      let sent = 0;
      let errors = 0;

      for (const email of parsed) {
        try {
          const ok = await postToN8n(email);
          if (ok) {
            sent++;
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
      }

      return { fetched: parsed.length, sent, errors };
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

async function postToN8n(payload: ParsedEmail): Promise<boolean> {
  const response = await fetch(N8N_TRIAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
  });

  return response.ok;
}

// ---------------------------------------------------------------------------
// Message parsing — mirrors poller/scripts/lib/imap-client.js parseMessage()
// ---------------------------------------------------------------------------

function parseMessage(msg: FetchMessageObject, tenantId: string): ParsedEmail {
  const envelope = (msg.envelope ?? {}) as Record<string, unknown>;
  const source = msg.source?.toString("utf-8") ?? "";

  const fromList = Array.isArray(envelope.from) ? envelope.from : [];
  const senderAddress =
    (fromList[0] as { name?: string; address?: string }) ?? {};
  const senderName = senderAddress.name ?? "";
  const senderEmail = senderAddress.address ?? "";
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

  const messageId =
    (typeof envelope.messageId === "string" ? envelope.messageId : "") ||
    `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const subject =
    typeof envelope.subject === "string" ? envelope.subject : "(no subject)";
  const date = envelope.date
    ? new Date(envelope.date as string).toISOString()
    : new Date().toISOString();

  const { bodyPlain, bodyHtml } = extractBodies(source);
  const body = bodyPlain || stripHtml(bodyHtml);

  return {
    tenant_id: tenantId,
    messageId,
    from,
    subject,
    body,
    date,
    sender_name: senderName,
    sender_email: senderEmail,
    body_plain: bodyPlain,
    body_html: bodyHtml,
    received_at: date,
    has_attachments: detectAttachments(msg.bodyStructure),
  };
}

// ---------------------------------------------------------------------------
// Body extraction — mirrors poller/scripts/lib/imap-client.js
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectAttachments(bodyStructure: unknown): boolean {
  if (!bodyStructure || typeof bodyStructure !== "object") return false;
  const bs = bodyStructure as Record<string, unknown>;

  if (bs.disposition === "attachment") return true;

  if (Array.isArray(bs.childNodes)) {
    return bs.childNodes.some((child: unknown) => detectAttachments(child));
  }

  return false;
}

function extractBodies(source: string): {
  bodyPlain: string;
  bodyHtml: string;
} {
  let bodyPlain = "";
  let bodyHtml = "";

  if (!source) return { bodyPlain, bodyHtml };

  const headerEnd = source.indexOf("\r\n\r\n");
  if (headerEnd === -1) return { bodyPlain, bodyHtml };

  const body = source.slice(headerEnd + 4);
  const contentTypeMatch = source.match(/Content-Type:\s*([^\r\n;]+)/i);
  const contentType =
    contentTypeMatch?.[1]?.trim()?.toLowerCase() ?? "text/plain";

  if (contentType.includes("multipart")) {
    const boundaryMatch = source.match(/boundary="?([^\r\n";]+)"?/i);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = body.split(`--${boundary}`);

      for (const part of parts) {
        const partTypeMatch = part.match(/Content-Type:\s*([^\r\n;]+)/i);
        const partType = partTypeMatch?.[1]?.trim()?.toLowerCase() ?? "";
        const partHeaderEnd = part.indexOf("\r\n\r\n");

        if (partHeaderEnd === -1) continue;

        let partBody = part.slice(partHeaderEnd + 4).trim();

        const transferMatch = part.match(/Content-Transfer-Encoding:\s*(\S+)/i);
        const encoding = transferMatch?.[1]?.trim()?.toLowerCase();

        if (encoding === "base64") {
          try {
            partBody = Buffer.from(
              partBody.replace(/\s/g, ""),
              "base64",
            ).toString("utf-8");
          } catch {
            // keep raw if decode fails
          }
        } else if (encoding === "quoted-printable") {
          partBody = decodeQuotedPrintable(partBody);
        }

        if (partType.includes("text/plain") && !bodyPlain) {
          bodyPlain = partBody;
        } else if (partType.includes("text/html") && !bodyHtml) {
          bodyHtml = partBody;
        }
      }
    }
  } else if (contentType.includes("text/html")) {
    bodyHtml = body;
  } else {
    bodyPlain = body;
  }

  return { bodyPlain, bodyHtml };
}

function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}
