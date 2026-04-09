import { ImapFlow } from "imapflow";

export async function fetchUnseenEmails(tenant) {
  const client = new ImapFlow({
    host: tenant.imap_host,
    port: tenant.imap_port,
    secure: true,
    auth: {
      user: tenant.imap_user,
      pass: tenant.imap_password,
    },
    logger: false,
    socketTimeout: 30_000,
  });

  const emails = [];

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const messages = client.fetch(
        { seen: false, since: oneDayAgo },
        {
          uid: true,
          envelope: true,
          source: true,
          bodyStructure: true,
        },
      );

      for await (const msg of messages) {
        const parsed = parseMessage(msg, tenant.tenant_id);
        emails.push({ ...parsed, uid: msg.uid });
      }

      if (emails.length > 10) {
        emails.sort(
          (a, b) => new Date(b.received_at) - new Date(a.received_at),
        );
        emails.length = 10;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return { emails };
}

export async function markAsSeen(tenant, uid) {
  const client = new ImapFlow({
    host: tenant.imap_host,
    port: tenant.imap_port,
    secure: true,
    auth: {
      user: tenant.imap_user,
      pass: tenant.imap_password,
    },
    logger: false,
    socketTimeout: 30_000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

function parseMessage(msg, tenantId) {
  const envelope = msg.envelope;
  const source = msg.source?.toString("utf-8") ?? "";

  const senderAddress = envelope.from?.[0] ?? {};
  const senderName = senderAddress.name ?? "";
  const senderEmail = senderAddress.address ?? "";
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

  const messageId =
    envelope.messageId ??
    `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const subject = envelope.subject ?? "(no subject)";
  const date = envelope.date
    ? new Date(envelope.date).toISOString()
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

function stripHtml(html) {
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

function detectAttachments(bodyStructure) {
  if (!bodyStructure) return false;

  if (bodyStructure.disposition === "attachment") return true;

  if (bodyStructure.childNodes) {
    return bodyStructure.childNodes.some((child) => detectAttachments(child));
  }

  return false;
}

function extractBodies(source) {
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

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function extractHeaders(source) {
  if (!source) return "";

  const headerEnd = source.indexOf("\r\n\r\n");
  if (headerEnd === -1) return "";

  return source.slice(0, headerEnd);
}
